import { z } from 'zod';

/**
 * Settings staff can change from the admin console without a redeploy.
 *
 * Every field has a default, and parsing a stored document fills in whatever
 * is missing — so adding a setting is a code change only, and a row written by
 * an older version still reads cleanly.
 */
export const submissionSettingsSchema = z.object({
  /** Show the "list your property" buttons and accept the form. */
  enabled: z.boolean().default(true),
  /** Photos required before the form can be sent. */
  minPhotos: z.coerce.number().int().min(0).max(10).default(1),
  /** Email the owner when their property is accepted. */
  notifyOnApprove: z.boolean().default(true),
  /** Email the owner when their property is declined (staff can untick it per case). */
  notifyOnReject: z.boolean().default(true),
});

export type SubmissionSettings = z.output<typeof submissionSettingsSchema>;
export type SubmissionSettingsInput = z.input<typeof submissionSettingsSchema>;

export const settingsKeys = {
  submissions: 'submissions',
} as const;

export const defaultSubmissionSettings: SubmissionSettings = submissionSettingsSchema.parse({});
