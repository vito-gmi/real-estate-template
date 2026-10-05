'use server';

import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { createSignedToken } from '@/lib/signing';
import { currentStaffOrNull } from '@/server/auth/session';
import { revalidateListingCaches } from '@/server/cache';
import { clientIp, hashIp } from '@/server/rate-limit';
import { db } from '@/server/db/client';
import { listingFeatures, listingTranslations, listings } from '@/server/db/schema';
import { listingPath } from '@/lib/routes';
import { listingStatuses } from '@/lib/domain/enums';
import { diffOf, recordAudit } from '@/server/repositories/audit';
import {
  getAdminListing,
  resolveFeatureIds,
  resolveLocationAncestry,
} from '@/server/repositories/admin-listings';
import { listingFormSchema, statusChangeSchema, type ListingFormValues } from './listing-schema';
import { buildSlug, listingColumns, translationPairs } from './listing-write';

/**
 * Listing write operations.
 *
 * Every action follows the same four beats: authorise, validate, write inside a
 * transaction, then invalidate caches and record what happened. Doing the last
 * two consistently is what makes the published site update immediately and makes
 * "who changed this price?" answerable months later.
 */

const PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

async function requireEditor() {
  return currentStaffOrNull('editor');
}

export const createListing = actionClient
  .metadata({ name: 'createListing' })
  .inputSchema(listingFormSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const values = parsedInput as ListingFormValues;
    const ancestry = await resolveLocationAncestry(values.locationId);

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(listings)
        .values({
          ...listingColumns(values, ancestry),
          publishedAt: values.status === 'draft' ? null : new Date(),
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: listings.id, reference: listings.reference });

      const created = row!;
      const pairs = translationPairs(values);

      await tx.insert(listingTranslations).values(
        pairs.map((pair) => ({
          listingId: created.id,
          locale: pair.locale,
          title: pair.title,
          description: pair.description,
          slug: buildSlug(pair.slug, pair.title, created.reference),
          metaTitle: pair.metaTitle ?? null,
          metaDescription: pair.metaDescription ?? null,
        })),
      );

      const featureIds = await resolveFeatureIds(values.featureKeys);
      if (featureIds.length > 0) {
        await tx
          .insert(listingFeatures)
          .values(featureIds.map((featureId) => ({ listingId: created.id, featureId })));
      }

      return created.id;
    });

    revalidateListingCaches(id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'listing.create',
      entityType: 'listing',
      entityId: id,
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id });
  });

export const updateListing = actionClient
  .metadata({ name: 'updateListing' })
  .inputSchema(listingFormSchema.and(z.object({ id: z.uuid() })))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const { id, ...rest } = parsedInput as ListingFormValues & { id: string };
    const values = rest as ListingFormValues;

    const existing = await getAdminListing(id);
    if (!existing) return actionErr('not_found', 'errors.notFound');

    const ancestry = await resolveLocationAncestry(values.locationId);
    const columns = listingColumns(values, ancestry);

    await db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({
          ...columns,
          // Set the first time it goes live and preserved thereafter, so the
          // "newest first" ordering does not jump when someone edits a typo.
          publishedAt:
            values.status === 'draft'
              ? null
              : (existing.listing.publishedAt ?? new Date()),
          updatedBy: user.id,
        })
        .where(eq(listings.id, id));

      const pairs = translationPairs(values);
      for (const pair of pairs) {
        const current = existing.translations[pair.locale];
        await tx
          .insert(listingTranslations)
          .values({
            listingId: id,
            locale: pair.locale,
            title: pair.title,
            description: pair.description,
            slug: current?.slug ?? buildSlug(pair.slug, pair.title, existing.listing.reference),
            metaTitle: pair.metaTitle ?? null,
            metaDescription: pair.metaDescription ?? null,
          })
          .onConflictDoUpdate({
            target: [listingTranslations.listingId, listingTranslations.locale],
            set: {
              title: pair.title,
              description: pair.description,
              // An explicit slug change is honoured; otherwise the published URL
              // is left alone so existing links keep working.
              ...(pair.slug ? { slug: buildSlug(pair.slug, pair.title, existing.listing.reference) } : {}),
              metaTitle: pair.metaTitle ?? null,
              metaDescription: pair.metaDescription ?? null,
            },
          });
      }

      await tx.delete(listingFeatures).where(eq(listingFeatures.listingId, id));
      const featureIds = await resolveFeatureIds(values.featureKeys);
      if (featureIds.length > 0) {
        await tx
          .insert(listingFeatures)
          .values(featureIds.map((featureId) => ({ listingId: id, featureId })));
      }
    });

    revalidateListingCaches(id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'listing.update',
      entityType: 'listing',
      entityId: id,
      diff: diffOf(existing.listing as unknown as Record<string, unknown>, columns),
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id });
  });

export const changeListingStatus = actionClient
  .metadata({ name: 'changeListingStatus' })
  .inputSchema(statusChangeSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const existing = await getAdminListing(parsedInput.id);
    if (!existing) return actionErr('not_found', 'errors.notFound');

    await db
      .update(listings)
      .set({
        status: parsedInput.status,
        publishedAt:
          parsedInput.status === 'draft'
            ? null
            : (existing.listing.publishedAt ?? new Date()),
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(listings.id, parsedInput.id));

    revalidateListingCaches(parsedInput.id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: `listing.status.${parsedInput.status}`,
      entityType: 'listing',
      entityId: parsedInput.id,
      diff: { status: { from: existing.listing.status, to: parsedInput.status } },
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id: parsedInput.id });
  });

export const deleteListing = actionClient
  .metadata({ name: 'deleteListing' })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    // Deletion is destructive and cascades to media rows, so it is the one
    // operation restricted to full administrators.
    const user = await currentStaffOrNull('admin');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const existing = await getAdminListing(parsedInput.id);
    if (!existing) return actionErr('not_found', 'errors.notFound');

    await db.delete(listings).where(eq(listings.id, parsedInput.id));

    revalidateListingCaches(parsedInput.id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'listing.delete',
      entityType: 'listing',
      entityId: parsedInput.id,
      diff: { reference: { from: existing.listing.reference, to: null } },
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ id: parsedInput.id });
  });

const bulkIdsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});

export const bulkChangeListingStatus = actionClient
  .metadata({ name: 'bulkChangeListingStatus' })
  .inputSchema(bulkIdsSchema.extend({ status: z.enum(listingStatuses) }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ count: number }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const now = new Date();
    await db
      .update(listings)
      .set({
        status: parsedInput.status,
        publishedAt: parsedInput.status === 'draft' ? null : now,
        updatedAt: now,
        updatedBy: user.id,
      })
      .where(inArray(listings.id, parsedInput.ids));

    for (const id of parsedInput.ids) revalidateListingCaches(id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: `listing.bulk.status.${parsedInput.status}`,
      entityType: 'listing',
      entityId: parsedInput.ids[0],
      diff: { count: { from: 0, to: parsedInput.ids.length } },
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ count: parsedInput.ids.length });
  });

export const bulkDeleteListings = actionClient
  .metadata({ name: 'bulkDeleteListings' })
  .inputSchema(bulkIdsSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ count: number }>> => {
    const user = await currentStaffOrNull('admin');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    await db.delete(listings).where(inArray(listings.id, parsedInput.ids));

    for (const id of parsedInput.ids) revalidateListingCaches(id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'listing.bulk.delete',
      entityType: 'listing',
      entityId: parsedInput.ids[0],
      diff: { count: { from: parsedInput.ids.length, to: 0 } },
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ count: parsedInput.ids.length });
  });

const PREVIEW_ID_SCHEMA = z.object({ id: z.uuid(), locale: z.enum(['bg', 'en']) });

/**
 * Issues a capability URL an owner can open without an account. The token is
 * bound to the listing id and expires in a week — long enough to share over
 * email, short enough that a leaked link does not live forever.
 */
export const createPreviewLink = actionClient
  .metadata({ name: 'createPreviewLink' })
  .inputSchema(PREVIEW_ID_SCHEMA)
  .action(async ({ parsedInput }): Promise<ActionResult<{ url: string }>> => {
    const user = await requireEditor();
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const existing = await getAdminListing(parsedInput.id);
    if (!existing) return actionErr('not_found', 'errors.notFound');

    const token = createSignedToken('preview', parsedInput.id, PREVIEW_TTL_SECONDS);
    const slug = existing.translations[parsedInput.locale]?.slug;
    if (!slug) return actionErr('not_found', 'errors.notFound');

    const path = `${listingPath(parsedInput.locale, slug)}?preview=${encodeURIComponent(token)}`;

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'listing.preview_link',
      entityType: 'listing',
      entityId: parsedInput.id,
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ url: path });
  });
