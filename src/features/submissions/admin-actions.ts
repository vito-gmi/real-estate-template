'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { after } from 'next/server';
import { listingFormSchema } from '@/features/admin/listing-schema';
import { buildSlug, listingColumns, translationPairs } from '@/features/admin/listing-write';
import { attachProcessedImage } from '@/features/media/attach';
import { processImage } from '@/features/media/pipeline';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { privateStorage, storage } from '@/server/adapters/storage';
import { currentStaffOrNull } from '@/server/auth/session';
import { db } from '@/server/db/client';
import {
  listingFeatures,
  listingTranslations,
  listings,
  propertySubmissions,
} from '@/server/db/schema';
import { recordAudit } from '@/server/repositories/audit';
import {
  resolveFeatureIds,
  resolveLocationAncestry,
} from '@/server/repositories/admin-listings';
import { clientIp, hashIp } from '@/server/rate-limit';
import {
  deleteSubmissionPhotos,
  deleteSubmissionRow,
  getSubmission,
  getSubmissionPhoto,
  getSubmissionPlace,
  listSubmissionPhotos,
  markSubmissionPhotoImported,
  transitionSubmission,
  updateSubmission,
} from '@/server/repositories/submissions';
import { sendSubmissionApproved, sendSubmissionRejected } from './emails';
import { submissionKeyPrefix } from './photos';
import {
  approveSubmissionSchema,
  importSubmissionPhotoSchema,
  rejectSubmissionSchema,
  submissionIdSchema,
  submissionNoteSchema,
} from './schema';
import { submissionTitles, submissionToListingInput } from './to-listing';

/**
 * Reviewing property submissions.
 *
 * Approving creates a draft listing and nothing more: an agent still reads it,
 * translates it and publishes it from the normal editor. Photos are copied
 * into public media one per request (the browser drives the loop), so a
 * submission with thirty photos never runs into a serverless time limit, and
 * an interrupted import can simply be resumed.
 */

class StaleSubmissionError extends Error {}

async function audit(
  user: { id: string; email: string },
  action: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action,
    entityType,
    entityId,
    ipHash: hashIp(await clientIp()),
  });
}

export const approveSubmission = actionClient
  .metadata({ name: 'approveSubmission' })
  .inputSchema(approveSubmissionSchema)
  .action(
    async ({ parsedInput }): Promise<ActionResult<{ listingId: string; photoIds: string[] }>> => {
      const user = await currentStaffOrNull('editor');
      if (!user) return actionErr('forbidden', 'errors.forbidden');

      const submission = await getSubmission(parsedInput.id);
      if (!submission || submission.status === 'incomplete') {
        return actionErr('not_found', 'errors.notFound');
      }

      const photos = await listSubmissionPhotos(submission.id);
      const importable = (ids: readonly string[]) =>
        ids.filter((id) =>
          photos.some((photo) => photo.id === id && !photo.importedMediaId && !photo.purgedAt),
        );

      // Already approved (double click, or resuming an interrupted import).
      if (submission.status === 'approved' && submission.listingId) {
        return actionOk({ listingId: submission.listingId, photoIds: importable(parsedInput.photoIds) });
      }
      if (submission.status !== 'pending' && submission.status !== 'rejected') {
        return actionErr('conflict', 'errors.conflict');
      }

      if (!parsedInput.locationId) return actionErr('validation', 'admin.errors.location');
      const place = await getSubmissionPlace(parsedInput.locationId);
      if (!place || (place.level !== 'district' && place.level !== 'city')) {
        return actionErr('validation', 'admin.errors.location');
      }

      const [tBg, tEn] = await Promise.all([
        getTranslations({ locale: 'bg', namespace: 'enums' }),
        getTranslations({ locale: 'en', namespace: 'enums' }),
      ]);
      const kind = submission.propertyKind ?? 'apartment';
      const titles = submissionTitles({
        kindBg: tBg(`propertyKind.${kind}`),
        kindEn: tEn(`propertyKind.${kind}`),
        placeBg: [place.nameBg, place.parentNameBg],
        placeEn: [place.nameEn, place.parentNameEn],
      });

      const parsed = listingFormSchema.safeParse(
        submissionToListingInput(submission, { locationId: place.id, ...titles }),
      );
      if (!parsed.success) return actionErr('validation', 'errors.validation');
      const values = parsed.data;
      const ancestry = await resolveLocationAncestry(values.locationId);
      const featureIds = await resolveFeatureIds(values.featureKeys);

      let listingId: string;
      try {
        listingId = await db.transaction(async (tx) => {
          // Claim the submission first, so two reviewers cannot both approve it.
          const claimed = await tx
            .update(propertySubmissions)
            .set({
              status: 'approved',
              reviewedBy: user.id,
              reviewedAt: new Date(),
              rejectionReason: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(propertySubmissions.id, submission.id),
                inArray(propertySubmissions.status, ['pending', 'rejected']),
              ),
            )
            .returning({ id: propertySubmissions.id });
          if (claimed.length === 0) throw new StaleSubmissionError();

          const [row] = await tx
            .insert(listings)
            .values({
              ...listingColumns(values, ancestry),
              publishedAt: null,
              createdBy: user.id,
              updatedBy: user.id,
            })
            .returning({ id: listings.id, reference: listings.reference });
          const created = row!;

          await tx.insert(listingTranslations).values(
            translationPairs(values).map((pair) => ({
              listingId: created.id,
              locale: pair.locale,
              title: pair.title,
              description: pair.description,
              slug: buildSlug(pair.slug, pair.title, created.reference),
              metaTitle: pair.metaTitle ?? null,
              metaDescription: pair.metaDescription ?? null,
            })),
          );

          if (featureIds.length > 0) {
            await tx
              .insert(listingFeatures)
              .values(featureIds.map((featureId) => ({ listingId: created.id, featureId })));
          }

          await tx
            .update(propertySubmissions)
            .set({ listingId: created.id })
            .where(eq(propertySubmissions.id, submission.id));

          return created.id;
        });
      } catch (error) {
        if (error instanceof StaleSubmissionError) return actionErr('conflict', 'errors.conflict');
        throw error;
      }

      // Drafts are not public, so no public cache needs invalidating here.
      await audit(user, 'submission.approve', 'submission', submission.id);
      await audit(user, 'listing.create_from_submission', 'listing', listingId);

      if (parsedInput.notify) {
        after(() => sendSubmissionApproved(submission));
      }

      return actionOk({ listingId, photoIds: importable(parsedInput.photoIds) });
    },
  );

export const importSubmissionPhoto = actionClient
  .metadata({ name: 'importSubmissionPhoto' })
  .inputSchema(importSubmissionPhotoSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ mediaId: string }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const submission = await getSubmission(parsedInput.submissionId);
    if (!submission?.listingId || submission.status !== 'approved') {
      return actionErr('conflict', 'errors.conflict');
    }

    const photo = await getSubmissionPhoto(parsedInput.photoId);
    if (!photo || photo.submissionId !== submission.id || photo.purgedAt) {
      return actionErr('not_found', 'errors.notFound');
    }
    if (photo.importedMediaId) return actionOk({ mediaId: photo.importedMediaId });

    let bytes: Buffer;
    try {
      bytes = await privateStorage().get(photo.storageKey);
    } catch {
      return actionErr('storage_failure', 'errors.storage');
    }

    // The same pipeline as an agent's own upload: content-hashed derivatives
    // in the public bucket, then a media row and a refreshed cover.
    const processed = await processImage(storage(), bytes);
    const { id: mediaId } = await attachProcessedImage(submission.listingId, processed);
    await markSubmissionPhotoImported(photo.id, mediaId);

    return actionOk({ mediaId });
  });

export const rejectSubmission = actionClient
  .metadata({ name: 'rejectSubmission' })
  .inputSchema(rejectSubmissionSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const moved = await transitionSubmission(parsedInput.id, ['pending'], {
      status: 'rejected',
      reviewedBy: user.id,
      reviewedAt: new Date(),
      rejectionReason: parsedInput.reason ?? null,
    });
    if (!moved) return actionErr('conflict', 'errors.conflict');

    await audit(user, 'submission.reject', 'submission', parsedInput.id);

    if (parsedInput.notify) {
      const submission = await getSubmission(parsedInput.id);
      if (submission) after(() => sendSubmissionRejected(submission, parsedInput.reason));
    }

    return actionOk({ id: parsedInput.id });
  });

/** Spam keeps the row (for the record) but drops the files at once. */
export const markSubmissionSpam = actionClient
  .metadata({ name: 'markSubmissionSpam' })
  .inputSchema(submissionIdSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('editor');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const moved = await transitionSubmission(parsedInput.id, ['pending', 'rejected'], {
      status: 'spam',
      reviewedBy: user.id,
      reviewedAt: new Date(),
    });
    if (!moved) return actionErr('conflict', 'errors.conflict');

    const photos = await listSubmissionPhotos(parsedInput.id);
    await privateStorage()
      .removePrefix(submissionKeyPrefix(parsedInput.id))
      .catch((error: unknown) => console.error('[submissions] spam photo cleanup failed', error));
    await deleteSubmissionPhotos(photos.map((photo) => photo.id));

    await audit(user, 'submission.spam', 'submission', parsedInput.id);
    return actionOk({ id: parsedInput.id });
  });

/**
 * Erases a submission and its files — for a data-subject request, or to clear
 * out junk. A listing already created from it is left alone.
 */
export const deleteSubmission = actionClient
  .metadata({ name: 'deleteSubmission' })
  .inputSchema(submissionIdSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('admin');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    const submission = await getSubmission(parsedInput.id);
    if (!submission) return actionErr('not_found', 'errors.notFound');

    await privateStorage().removePrefix(submissionKeyPrefix(submission.id));
    await deleteSubmissionRow(submission.id);

    await audit(user, 'submission.delete', 'submission', submission.id);
    return actionOk({ id: submission.id });
  });

export const saveSubmissionNote = actionClient
  .metadata({ name: 'saveSubmissionNote' })
  .inputSchema(submissionNoteSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const user = await currentStaffOrNull('agent');
    if (!user) return actionErr('forbidden', 'errors.forbidden');

    await updateSubmission(parsedInput.id, { internalNote: parsedInput.note || null });
    return actionOk({ id: parsedInput.id });
  });
