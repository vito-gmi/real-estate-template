'use server';

import { z } from 'zod';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { currentStaffOrNull } from '@/server/auth/session';
import { revalidateListingCaches } from '@/server/cache';
import { db } from '@/server/db/client';
import { listingFeatures, listingTranslations, listings } from '@/server/db/schema';
import { clientIp, hashIp } from '@/server/rate-limit';
import { recordAudit } from '@/server/repositories/audit';
import { resolveFeatureIds, resolveLocationAncestry } from '@/server/repositories/admin-listings';
import { parseImportPayload } from './import-export';
import { buildSlug, listingColumns, translationPairs } from './listing-write';

export const importListings = actionClient
  .metadata({ name: 'importListings' })
  .inputSchema(z.object({ filename: z.string().max(180), content: z.string().max(2_000_000) }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ count: number }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    let records;
    try {
      records = parseImportPayload(parsedInput.content, parsedInput.filename);
    } catch (error) {
      return actionErr(
        'validation',
        error instanceof Error ? error.message : 'errors.validation',
      );
    }

    if (records.length === 0) return actionOk({ count: 0 });

    let count = 0;
    for (const values of records) {
      const ancestry = await resolveLocationAncestry(values.locationId);
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(listings)
          .values({
            ...listingColumns(values, ancestry),
            status: 'draft',
            publishedAt: null,
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
      });
      count += 1;
    }

    revalidateListingCaches();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'listing.import',
      entityType: 'listing',
      diff: { count: { from: 0, to: count } },
      ipHash: hashIp(await clientIp()),
    });

    return actionOk({ count });
  });
