import { z } from 'zod';
import { inquiryKinds } from '@/lib/domain/enums';
import { locales } from '@/i18n/routing';

/**
 * One schema, three jobs: it types the form, validates the submission on the
 * server, and generates the client-side error messages. There is no second
 * definition that could drift out of step with this one.
 */
export const inquirySchema = z.object({
  listingId: z.uuid().optional(),
  kind: z.enum(inquiryKinds).default('message'),
  name: z.string().trim().min(2, 'inquiry.errors.name').max(120),
  email: z.email('inquiry.errors.email').max(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((value) => !value || /^[\d\s+()./-]{6,}$/.test(value), 'inquiry.errors.phone'),
  message: z.string().trim().max(2000).default(''),
  locale: z.enum(locales).default('bg'),
  consent: z.literal(true, 'inquiry.consentRequired'),
  /**
   * Honeypot. Real people never fill a field they cannot see, so anything in it
   * is a bot — and rejecting it costs nothing and needs no third-party captcha.
   */
  website: z.string().max(0).optional(),
});

export type InquiryInput = z.input<typeof inquirySchema>;
export type InquiryValues = z.output<typeof inquirySchema>;
