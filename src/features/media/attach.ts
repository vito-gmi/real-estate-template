import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import type { CoverImage } from '@/lib/domain/media';
import type { MediaKind } from '@/lib/domain/enums';
import { db } from '@/server/db/client';
import { listings, media } from '@/server/db/schema';
import type { ProcessedImage } from './pipeline';

/**
 * Writing processed photos onto a listing.
 *
 * Kept out of the `'use server'` actions module: every export there becomes a
 * callable endpoint, and these helpers do no authorisation of their own. Both
 * the media manager and submission approval go through here, so a photo is
 * attached the same way whoever uploaded it.
 */

export async function attachProcessedImage(
  listingId: string,
  processed: ProcessedImage,
  kind: MediaKind = 'photo',
): Promise<{ id: string }> {
  const [orderRow] = await db
    .select({
      nextOrder: sql<number>`coalesce(max(${media.sortOrder}), -1) + 1`,
    })
    .from(media)
    .where(and(eq(media.listingId, listingId), eq(media.kind, kind)));
  const nextOrder = orderRow?.nextOrder ?? 0;

  const [row] = await db
    .insert(media)
    .values({
      listingId,
      kind,
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

  await syncCoverImage(listingId);
  return { id: row!.id };
}

/**
 * Keeps the denormalised cover snapshot on the listing in step with the first
 * photo. This is the only writer of that column — the reason the listing grid
 * can render without touching the media table.
 */
export async function syncCoverImage(listingId: string): Promise<void> {
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
