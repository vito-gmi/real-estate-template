import 'server-only';

import { clientEnv } from '@/env';
import type { SubmissionSettings } from '@/features/settings/schema';
import { isPrivateStorageConfigured } from '@/server/adapters/storage';
import { getCachedSubmissionSettings, getSubmissionSettings } from '@/server/repositories/settings';
import { isTurnstileEnabled } from '@/server/turnstile';

/**
 * Whether the public "list your property" form is open.
 *
 * Two switches must both be on: the staff toggle in Settings, and somewhere
 * private to put the photos. Without a private bucket the form stays closed
 * however the toggle is set, because the alternative is publishing strangers'
 * files before review.
 */
export type SubmissionAvailability = {
  readonly open: boolean;
  readonly settings: SubmissionSettings;
  readonly storageReady: boolean;
  /** Site key when Turnstile is fully configured, else null. */
  readonly turnstileSiteKey: string | null;
};

function availability(settings: SubmissionSettings): SubmissionAvailability {
  const storageReady = isPrivateStorageConfigured();
  return {
    open: settings.enabled && storageReady,
    settings,
    storageReady,
    turnstileSiteKey: isTurnstileEnabled() ? (clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null,
  };
}

/** For rendering public pages (cached, tag-invalidated). */
export async function getPublicSubmissionAvailability(): Promise<SubmissionAvailability> {
  return availability(await getCachedSubmissionSettings());
}

/** For decisions inside actions, where a stale "open" must not let a write through. */
export async function getLiveSubmissionAvailability(): Promise<SubmissionAvailability> {
  return availability(await getSubmissionSettings());
}
