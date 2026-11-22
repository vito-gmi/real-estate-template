'use server';

import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { currentStaffOrNull } from '@/server/auth/session';
import { revalidateSettingsCaches } from '@/server/cache';
import { clientIp, hashIp } from '@/server/rate-limit';
import { diffOf, recordAudit } from '@/server/repositories/audit';
import { getSubmissionSettings, saveSubmissionSettings } from '@/server/repositories/settings';
import { submissionSettingsSchema, type SubmissionSettings } from './schema';

/**
 * Saving the Settings page. Admins only: these switches change what every
 * visitor sees and who gets emailed, so they are not an editor's call.
 */
export const updateSubmissionSettings = actionClient
  .metadata({ name: 'updateSubmissionSettings' })
  .inputSchema(submissionSettingsSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<SubmissionSettings>> => {
    const user = await currentStaffOrNull('admin');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const before = await getSubmissionSettings();
    await saveSubmissionSettings(parsedInput, user.id);
    // The header and the form page read these; show the change immediately.
    revalidateSettingsCaches();

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'settings.update',
      entityType: 'settings',
      entityId: 'submissions',
      diff: diffOf(before, parsedInput),
      ipHash: hashIp(await clientIp()),
    });

    return actionOk(parsedInput);
  });
