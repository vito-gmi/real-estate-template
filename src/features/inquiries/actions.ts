'use server';

import { headers } from 'next/headers';
import { siteConfig } from '@/config/site';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { mailer } from '@/server/adapters/mail';
import { checkRateLimit, clientIp, hashIp } from '@/server/rate-limit';
import { createInquiry } from '@/server/repositories/inquiries';
import { inquirySchema, type InquiryValues } from './schema';

/**
 * Lead capture.
 *
 * The defences are layered, cheapest first: a honeypot rejects naive bots for
 * free, then a per-address and per-email rate limit bounds what a determined one
 * can do, and only then does anything touch the database. Storing the lead is
 * what must succeed; notifying the office is best-effort, because a mail
 * provider outage should never lose an enquiry the visitor believes was sent.
 */
export const submitInquiry = actionClient
  .metadata({ name: 'submitInquiry' })
  .inputSchema(inquirySchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const values = parsedInput as InquiryValues;

    if (values.website) {
      // Silently accept so the bot has nothing to learn from the response.
      return actionOk({ id: 'discarded' });
    }

    const ip = await clientIp();

    const [byIp, byEmail] = await Promise.all([
      checkRateLimit('inquiry:ip', hashIp(ip)),
      checkRateLimit('inquiry:email', values.email.toLowerCase()),
    ]);

    if (!byIp.success || !byEmail.success) {
      return actionErr('rate_limited', 'errors.rateLimited', {
        retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds),
      });
    }

    const headerList = await headers();

    const { id } = await createInquiry({
      listingId: values.listingId ?? null,
      kind: values.kind,
      name: values.name,
      email: values.email,
      phone: values.phone || null,
      message: values.message,
      locale: values.locale,
      source: values.listingId ? 'listing' : 'contact',
      ipHash: hashIp(ip),
      userAgent: headerList.get('user-agent')?.slice(0, 300) ?? null,
    });

    const recipient = siteConfig.contact.email;
    try {
      await mailer().send({
        to: recipient,
        replyTo: values.email,
        subject: values.listingId
          ? `New enquiry · listing ${values.listingId.slice(0, 8)}`
          : 'New enquiry · contact form',
        text: [
          `Name: ${values.name}`,
          `Email: ${values.email}`,
          values.phone ? `Phone: ${values.phone}` : null,
          `Type: ${values.kind}`,
          values.listingId ? `Listing: ${siteConfig.url}/admin/listings/${values.listingId}` : null,
          '',
          values.message || '(no message)',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch (error) {
      // The lead is already safe in the database and visible in the inbox.
      console.error('[submitInquiry] notification failed', error);
    }

    return actionOk({ id });
  });
