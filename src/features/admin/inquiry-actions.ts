'use server';

import { z } from 'zod';
import { inquiryStatuses } from '@/lib/domain/enums';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { currentStaffOrNull } from '@/server/auth/session';
import { clientIp, hashIp } from '@/server/rate-limit';
import { recordAudit } from '@/server/repositories/audit';
import { updateInquiryStatus } from '@/server/repositories/inquiries';

export const setInquiryStatus = actionClient
  .metadata({ name: 'setInquiryStatus' })
  .inputSchema(z.object({ id: z.uuid(), status: z.enum(inquiryStatuses) }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    // Agents handle leads; that is the whole point of the role.
    const user = await currentStaffOrNull('agent');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    await updateInquiryStatus(parsedInput.id, parsedInput.status, user.id);

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: `inquiry.status.${parsedInput.status}`,
      entityType: 'inquiry',
      entityId: parsedInput.id,
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id: parsedInput.id });
  });
