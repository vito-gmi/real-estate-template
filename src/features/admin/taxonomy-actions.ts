'use server';

import { z } from 'zod';
import { locationLevels } from '@/lib/domain/enums';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { currentStaffOrNull } from '@/server/auth/session';
import { revalidateTaxonomyCaches } from '@/server/cache';
import { clientIp, hashIp } from '@/server/rate-limit';
import { recordAudit } from '@/server/repositories/audit';
import * as taxonomy from '@/server/repositories/admin-taxonomy';

async function requireEditor() {
  return currentStaffOrNull('editor');
}

const locationSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  level: z.enum(locationLevels),
  nameBg: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  slugBg: z.string().trim().max(80).optional(),
  slugEn: z.string().trim().max(80).optional(),
  lat: z.coerce.number<number>().optional(),
  lng: z.coerce.number<number>().optional(),
  sortOrder: z.coerce.number<number>().int().default(0),
  isActive: z.boolean().default(true),
});

const featureSchema = z.object({
  key: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(40).default('general'),
  nameBg: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.coerce.number<number>().int().default(0),
  isFilterable: z.boolean().default(true),
});

export const createLocation = actionClient
  .metadata({ name: 'createLocation' })
  .inputSchema(locationSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const id = await taxonomy.createLocation({
      ...parsedInput,
      parentId: parsedInput.parentId ?? null,
    });
    revalidateTaxonomyCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'taxonomy.location.create',
      entityType: 'location',
      entityId: id,
      ipHash: hashIp(await clientIp()),
    });
    return actionOk({ id });
  });

export const updateLocation = actionClient
  .metadata({ name: 'updateLocation' })
  .inputSchema(locationSchema.and(z.object({ id: z.uuid() })))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const { id, ...values } = parsedInput;
    await taxonomy.updateLocation(id, { ...values, parentId: values.parentId ?? null });
    revalidateTaxonomyCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'taxonomy.location.update',
      entityType: 'location',
      entityId: id,
      ipHash: hashIp(await clientIp()),
    });
    return actionOk({ id });
  });

export const deleteLocation = actionClient
  .metadata({ name: 'deleteLocation' })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('admin');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const result = await taxonomy.deleteLocation(parsedInput.id);
    if (result === 'in_use') return actionErr('conflict', 'errors.conflict');

    revalidateTaxonomyCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'taxonomy.location.delete',
      entityType: 'location',
      entityId: parsedInput.id,
      ipHash: hashIp(await clientIp()),
    });
    return actionOk({ id: parsedInput.id });
  });

export const createFeature = actionClient
  .metadata({ name: 'createFeature' })
  .inputSchema(featureSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const id = await taxonomy.createFeature(parsedInput);
    revalidateTaxonomyCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'taxonomy.feature.create',
      entityType: 'feature',
      entityId: id,
      ipHash: hashIp(await clientIp()),
    });
    return actionOk({ id });
  });

export const updateFeature = actionClient
  .metadata({ name: 'updateFeature' })
  .inputSchema(featureSchema.and(z.object({ id: z.uuid() })))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const { id, ...values } = parsedInput;
    await taxonomy.updateFeature(id, values);
    revalidateTaxonomyCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'taxonomy.feature.update',
      entityType: 'feature',
      entityId: id,
      ipHash: hashIp(await clientIp()),
    });
    return actionOk({ id });
  });

export const deleteFeature = actionClient
  .metadata({ name: 'deleteFeature' })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('admin');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    await taxonomy.deleteFeature(parsedInput.id);
    revalidateTaxonomyCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'taxonomy.feature.delete',
      entityType: 'feature',
      entityId: parsedInput.id,
      ipHash: hashIp(await clientIp()),
    });
    return actionOk({ id: parsedInput.id });
  });
