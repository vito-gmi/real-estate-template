'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { CoverImage } from '@/lib/domain/media';
import { MAX_UPLOAD_BYTES, isAcceptedImageType } from '@/lib/domain/media';
import { mediaKinds } from '@/lib/domain/enums';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { createSignedToken } from '@/lib/signing';
import { currentStaffOrNull } from '@/server/auth/session';
import { revalidateListingCaches } from '@/server/cache';
import { checkRateLimit, clientIp, hashIp } from '@/server/rate-limit';
import { storage } from '@/server/adapters/storage';
import { db } from '@/server/db/client';
import { listings, media } from '@/server/db/schema';
import { recordAudit } from '@/server/repositories/audit';
import { keysOf, processImage } from './pipeline';

/**
 * Media management.
 *
 * Uploads are a two-step handshake: the browser asks for a short-lived,
 * pre-signed URL and sends the bytes straight to object storage, then tells the
 * server the object has landed. The application server never proxies the file,
 * which matters on serverless hosting where request bodies are both size-capped
 * and billed by duration.
 */

const UPLOAD_TTL_SECONDS = 600;

const requestUploadSchema = z.object({
  listingId: z.uuid(),
  contentType: z.string().refine(isAcceptedImageType, 'errors.validation'),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

const attachSchema = z.object({
  listingId: z.uuid(),
  uploadKey: z.string().min(1).max(200),
  kind: z.enum(mediaKinds).default('photo'),
});

export const requestUpload = actionClient
  .metadata({ name: 'requestUpload' })
  .inputSchema(requestUploadSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ uploadKey: string; url: string; headers: Record<string, string> }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const limit = await checkRateLimit('upload:user', user.id);
    if (!limit.success) {
      return actionErr('rate_limited', 'errors.rateLimited', {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    // Staging key: the permanent key is derived from the file's content hash
    // once the bytes have been read and normalised.
    const uploadKey = `uploads/${parsedInput.listingId}/${randomUUID()}`;
    const presigned = await storage().createUploadUrl(uploadKey, parsedInput.contentType);

    const url = presigned.url.startsWith('/')
      ? `${presigned.url}&token=${createSignedToken('upload', uploadKey, UPLOAD_TTL_SECONDS)}`
      : presigned.url;

    return actionOk({ uploadKey, url, headers: { ...presigned.headers } });
  });

export const attachMedia = actionClient
  .metadata({ name: 'attachMedia' })
  .inputSchema(attachSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const store = storage();

    let original: Buffer;
    try {
      original = await store.get(parsedInput.uploadKey);
    } catch {
      return actionErr('storage_failure', 'errors.storage');
    }

    if (original.byteLength > MAX_UPLOAD_BYTES) {
      await store.remove([parsedInput.uploadKey]);
      return actionErr('validation', 'errors.validation');
    }

    let processed;
    try {
      processed = await processImage(store, original);
    } catch {
      await store.remove([parsedInput.uploadKey]);
      // A file that sharp cannot decode is not an image, whatever its extension
      // or declared content type said.
      return actionErr('validation', 'errors.validation');
    }

    // The staging copy has served its purpose; the permanent objects are keyed
    // by content hash.
    await store.remove([parsedInput.uploadKey]);

    const [orderRow] = await db
      .select({
        nextOrder: sql<number>`coalesce(max(${media.sortOrder}), -1) + 1`,
      })
      .from(media)
      .where(and(eq(media.listingId, parsedInput.listingId), eq(media.kind, parsedInput.kind)));
    const nextOrder = orderRow?.nextOrder ?? 0;

    const [row] = await db
      .insert(media)
      .values({
        listingId: parsedInput.listingId,
        kind: parsedInput.kind,
        storageKey: processed.storageKey,
        contentType: processed.contentType,
        bytes: processed.bytes,
        width: processed.width,
        height: processed.height,
        blurDataUrl: processed.blurDataUrl,
        variants: [...processed.variants],
        sortOrder: Number(nextOrder ?? 0),
      })
      .returning({ id: media.id });

    await syncCoverImage(parsedInput.listingId);
    revalidateListingCaches(parsedInput.listingId);

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'media.attach',
      entityType: 'listing',
      entityId: parsedInput.listingId,
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id: row!.id });
  });

export const reorderMedia = actionClient
  .metadata({ name: 'reorderMedia' })
  .inputSchema(z.object({ listingId: z.uuid(), orderedIds: z.array(z.uuid()).max(100) }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ count: number }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    await db.transaction(async (tx) => {
      for (const [index, id] of parsedInput.orderedIds.entries()) {
        await tx
          .update(media)
          .set({ sortOrder: index })
          .where(and(eq(media.id, id), eq(media.listingId, parsedInput.listingId)));
      }
    });

    await syncCoverImage(parsedInput.listingId);
    revalidateListingCaches(parsedInput.listingId);

    return actionOk({ count: parsedInput.orderedIds.length });
  });

export const deleteMedia = actionClient
  .metadata({ name: 'deleteMedia' })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const [row] = await db.select().from(media).where(eq(media.id, parsedInput.id)).limit(1);
    if (!row) return actionErr('not_found', 'errors.notFound');

    await db.delete(media).where(eq(media.id, parsedInput.id));

    /*
     * Objects are content-addressed, so the same bytes may back several
     * listings. Deleting the row is safe; deleting the objects is only safe once
     * nothing else references that hash.
     */
    const [countRow] = await db
      .select({ remaining: sql<number>`count(*)::int` })
      .from(media)
      .where(eq(media.storageKey, row.storageKey));

    if (Number(countRow?.remaining ?? 0) === 0) {
      await storage().remove(keysOf(row.storageKey, row.variants));
    }

    await syncCoverImage(row.listingId);
    revalidateListingCaches(row.listingId);

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'media.delete',
      entityType: 'listing',
      entityId: row.listingId,
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id: parsedInput.id });
  });

export const updateMediaAlt = actionClient
  .metadata({ name: 'updateMediaAlt' })
  .inputSchema(
    z.object({ id: z.uuid(), altBg: z.string().max(300).optional(), altEn: z.string().max(300).optional() }),
  )
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const [row] = await db
      .update(media)
      .set({ altBg: parsedInput.altBg ?? null, altEn: parsedInput.altEn ?? null })
      .where(eq(media.id, parsedInput.id))
      .returning({ id: media.id, listingId: media.listingId });

    if (!row) return actionErr('not_found', 'errors.notFound');
    revalidateListingCaches(row.listingId);
    return actionOk({ id: row.id });
  });

/**
 * Keeps the denormalised cover snapshot on the listing in step with the first
 * photo. This is the only writer of that column — the reason the listing grid
 * can render without touching the media table.
 */
async function syncCoverImage(listingId: string): Promise<void> {
  const [first] = await db
    .select({
      id: media.id,
      width: media.width,
      height: media.height,
      blurDataUrl: media.blurDataUrl,
      variants: media.variants,
    })
    .from(media)
    .where(and(eq(media.listingId, listingId), eq(media.kind, 'photo')))
    .orderBy(media.sortOrder)
    .limit(1);

  const cover: CoverImage | null = first
    ? {
        mediaId: first.id,
        width: first.width,
        height: first.height,
        blurDataUrl: first.blurDataUrl,
        variants: first.variants,
      }
    : null;

  await db.update(listings).set({ coverImage: cover }).where(eq(listings.id, listingId));
}
