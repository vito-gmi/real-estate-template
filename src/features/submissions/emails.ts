import 'server-only';

import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@/config/site';
import { serverEnv } from '@/env';
import type { Locale } from '@/i18n/routing';
import { adminPath } from '@/lib/routes';
import { mailer } from '@/server/adapters/mail';
import type { PropertySubmissionRow } from '@/server/db/schema';

/**
 * Submission emails.
 *
 * All best-effort: the submission is already stored and visible in the console
 * when these run, so a mail provider outage logs an error instead of telling a
 * visitor their property was lost. Visitor-facing mail is in the language they
 * used on the site; replies go to the office inbox.
 */

function officeInbox(): string {
  return serverEnv.MAIL_TO ?? siteConfig.contact.email;
}

async function send(label: string, message: Parameters<ReturnType<typeof mailer>['send']>[0]) {
  try {
    await mailer().send(message);
  } catch (error) {
    console.error(`[submissions] ${label} email failed`, error);
  }
}

type Summary = {
  readonly placeName: string | null;
  readonly photoCount: number;
};

/** Tells the office a new property is waiting for review. */
export async function notifyOfficeOfSubmission(
  submission: PropertySubmissionRow,
  summary: Summary,
): Promise<void> {
  const tEnum = await getTranslations({ locale: 'en', namespace: 'enums' });
  const kind = submission.propertyKind ? tEnum(`propertyKind.${submission.propertyKind}`) : '—';
  const deal = submission.dealType ? tEnum(`dealType.${submission.dealType}`) : '—';
  const place = summary.placeName ?? submission.locationText ?? '—';

  await send('office notification', {
    to: officeInbox(),
    replyTo: submission.email ?? undefined,
    subject: `New property submission #${submission.reference} · ${deal} · ${kind} · ${place}`,
    text: [
      `Submission #${submission.reference}`,
      `${deal} · ${kind}`,
      `Location: ${place}${submission.locationText && summary.placeName ? ` (${submission.locationText})` : ''}`,
      submission.price ? `Asking price: ${submission.price} ${submission.currency}` : null,
      submission.area ? `Area: ${submission.area} m²` : null,
      `Photos: ${summary.photoCount}`,
      submission.externalMediaUrl ? `More photos/video: ${submission.externalMediaUrl}` : null,
      '',
      `From: ${submission.firstName ?? ''} ${submission.lastName ?? ''} (${submission.submitterRole ?? 'owner'})`,
      `Email: ${submission.email ?? ''}`,
      `Phone: ${submission.phone ?? ''}`,
      submission.contactTime ? `Best time to call: ${submission.contactTime}` : null,
      '',
      `Review: ${siteConfig.url}${adminPath('bg', `submissions/${submission.id}`)}`,
    ]
      .filter((line) => line !== null)
      .join('\n'),
  });
}

async function visitorEmail(
  submission: PropertySubmissionRow,
  kind: 'received' | 'approved' | 'rejected',
  extra: { reason?: string } = {},
): Promise<void> {
  if (!submission.email) return;
  const locale = submission.locale as Locale;
  const t = await getTranslations({ locale, namespace: 'submitEmail' });
  const values = {
    name: submission.firstName ?? '',
    reference: submission.reference,
    site: siteConfig.name,
    phone: siteConfig.contact.phone,
  };

  const paragraphs = [
    t('greeting', values),
    t(`${kind}Body`, values),
    kind === 'rejected' && extra.reason ? t('reason', { reason: extra.reason }) : null,
    t('closing', values),
    t('signature', values),
  ].filter((line): line is string => Boolean(line));

  await send(`visitor ${kind}`, {
    to: submission.email,
    replyTo: siteConfig.contact.email,
    subject: t(`${kind}Subject`, values),
    text: paragraphs.join('\n\n'),
  });
}

export function sendSubmissionReceipt(submission: PropertySubmissionRow): Promise<void> {
  return visitorEmail(submission, 'received');
}

export function sendSubmissionApproved(submission: PropertySubmissionRow): Promise<void> {
  return visitorEmail(submission, 'approved');
}

export function sendSubmissionRejected(
  submission: PropertySubmissionRow,
  reason: string | undefined,
): Promise<void> {
  return visitorEmail(submission, 'rejected', { reason });
}
