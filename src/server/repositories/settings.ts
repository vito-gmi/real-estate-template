import 'server-only';

import { eq } from 'drizzle-orm';
import {
  defaultSubmissionSettings,
  settingsKeys,
  submissionSettingsSchema,
  type SubmissionSettings,
} from '@/features/settings/schema';
import { cacheTags, cacheTtl, cached } from '@/server/cache';
import { db } from '@/server/db/client';
import { appSettings } from '@/server/db/schema';

async function readSubmissionSettings(): Promise<SubmissionSettings> {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, settingsKeys.submissions))
      .limit(1);

    const parsed = submissionSettingsSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : defaultSubmissionSettings;
  } catch (error) {
    // The header reads this on every public page. A database outage must not
    // turn cached pages into errors, so fall back to the defaults.
    console.error('[settings] read failed; using defaults', error);
    return defaultSubmissionSettings;
  }
}

/** Uncached read, for the admin console and for decisions inside actions. */
export async function getSubmissionSettings(): Promise<SubmissionSettings> {
  return readSubmissionSettings();
}

/** Cached read for public pages; invalidated by `revalidateSettingsCaches`. */
export const getCachedSubmissionSettings = cached(readSubmissionSettings, ['settings', 'submissions'], {
  tags: [cacheTags.settings],
  revalidate: cacheTtl.settings,
});

export async function saveSubmissionSettings(
  value: SubmissionSettings,
  actorId: string,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: settingsKeys.submissions, value, updatedBy: actorId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: actorId, updatedAt: new Date() },
    });
}
