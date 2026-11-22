'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { z } from 'zod';
import { MAX_SUBMISSION_PHOTOS, MAX_UPLOAD_BYTES, isAcceptedImageType } from '@/lib/domain/media';
import { actionClient, actionErr, actionOk, type ActionResult } from '@/lib/safe-action';
import { createSignedToken, localUploadSubject, verifySignedToken } from '@/lib/signing';
import { privateStorage } from '@/server/adapters/storage';
import { checkRateLimit, clientIp, hashIp } from '@/server/rate-limit';
import {
  countSubmissionPhotos,
  createIncompleteSubmission,
  deleteSubmissionPhotos,
  getSubmission,
  getSubmissionPhoto,
  getSubmissionPlace,
  insertSubmissionPhoto,
  listSubmissionPhotos,
  resolveSubmittedPlace,
  setSubmissionPhotoOrder,
  transitionSubmission,
} from '@/server/repositories/submissions';
import { verifyTurnstile } from '@/server/turnstile';
import { getLiveSubmissionAvailability } from './availability';
import { notifyOfficeOfSubmission, sendSubmissionReceipt } from './emails';
import {
  PhotoTooSmallError,
  isStagingKeyFor,
  photoKeys,
  stagingKey,
  storeSubmissionPhoto,
} from './photos';
import {
  startSubmissionSchema,
  submissionSchema,
  submissionTokenSchema,
  type SubmissionValues,
} from './schema';

/**
 * The public "list your property" flow.
 *
 * 1. The first photo the visitor adds calls `startSubmission`, which creates an
 *    `incomplete` row and hands back a signed token for it.
 * 2. Each photo is shrunk in the browser, PUT straight to the private bucket
 *    with a presigned URL (`requestSubmissionUpload`), then decoded,
 *    sanitised and thumbnailed by `confirmSubmissionPhoto`. That work happens
 *    while the visitor is still typing, so the final submit is instant.
 * 3. `submitSubmission` validates everything, checks Turnstile, and moves the
 *    row to `pending`, where staff see it.
 *
 * Defences, cheapest first: honeypot, per-address and per-email rate limits,
 * Turnstile, then the database. Rows that never reach step 3 are deleted by
 * the cleanup job after a day.
 */

const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const UPLOAD_TTL_SECONDS = 600;
const TURNSTILE_ACTION = 'submit-property';

/** The submission behind a token, if it is still open for editing. */
async function openSubmission(token: string) {
  const id = verifySignedToken('submission', token);
  if (!id) return null;
  const submission = await getSubmission(id);
  return submission?.status === 'incomplete' ? submission : null;
}

export const startSubmission = actionClient
  .metadata({ name: 'startSubmission' })
  .inputSchema(startSubmissionSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ token: string }>> => {
    const availability = await getLiveSubmissionAvailability();
    if (!availability.open) return actionErr('forbidden', 'submit.errors.closed');

    const ipHash = hashIp(await clientIp());
    const limit = await checkRateLimit('submission:start', ipHash);
    if (!limit.success) {
      return actionErr('rate_limited', 'errors.rateLimited', {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const { id } = await createIncompleteSubmission({ locale: parsedInput.locale, ipHash });
    return actionOk({ token: createSignedToken('submission', id, TOKEN_TTL_SECONDS) });
  });

export const requestSubmissionUpload = actionClient
  .metadata({ name: 'requestSubmissionUpload' })
  .inputSchema(
    submissionTokenSchema.extend({
      contentType: z.string().refine(isAcceptedImageType, 'submit.errors.photoType'),
      size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    }),
  )
  .action(
    async ({
      parsedInput,
    }): Promise<ActionResult<{ uploadKey: string; url: string; headers: Record<string, string> }>> => {
      const submission = await openSubmission(parsedInput.token);
      if (!submission) return actionErr('forbidden', 'submit.errors.expired');

      const limit = await checkRateLimit('submission:upload', hashIp(await clientIp()));
      if (!limit.success) {
        return actionErr('rate_limited', 'errors.rateLimited', {
          retryAfterSeconds: limit.retryAfterSeconds,
        });
      }

      if ((await countSubmissionPhotos(submission.id)) >= MAX_SUBMISSION_PHOTOS) {
        return actionErr('validation', 'submit.errors.tooManyPhotos');
      }

      const uploadKey = stagingKey(submission.id);
      const presigned = await privateStorage().createUploadUrl(uploadKey, parsedInput.contentType, {
        contentLength: parsedInput.size,
      });
      // Local driver: the app's own upload route checks this signature.
      const url = presigned.url.startsWith('/')
        ? `${presigned.url}&token=${createSignedToken('upload', localUploadSubject('private', uploadKey), UPLOAD_TTL_SECONDS)}`
        : presigned.url;

      return actionOk({ uploadKey, url, headers: { ...presigned.headers } });
    },
  );

export const confirmSubmissionPhoto = actionClient
  .metadata({ name: 'confirmSubmissionPhoto' })
  .inputSchema(submissionTokenSchema.extend({ uploadKey: z.string().min(1).max(300) }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const submission = await openSubmission(parsedInput.token);
    if (!submission) return actionErr('forbidden', 'submit.errors.expired');
    // Only a key this server issued for this submission: never a path of the
    // caller's choosing.
    if (!isStagingKeyFor(submission.id, parsedInput.uploadKey)) {
      return actionErr('forbidden', 'errors.forbidden');
    }

    const store = privateStorage();
    let original: Buffer;
    try {
      original = await store.get(parsedInput.uploadKey);
    } catch {
      return actionErr('storage_failure', 'errors.storage');
    }

    try {
      if (original.byteLength > MAX_UPLOAD_BYTES) {
        return actionErr('validation', 'submit.errors.photoTooLarge');
      }

      const count = await countSubmissionPhotos(submission.id);
      if (count >= MAX_SUBMISSION_PHOTOS) {
        return actionErr('validation', 'submit.errors.tooManyPhotos');
      }

      let stored;
      try {
        stored = await storeSubmissionPhoto(store, submission.id, original);
      } catch (error) {
        return actionErr(
          'validation',
          error instanceof PhotoTooSmallError ? 'submit.errors.photoTooSmall' : 'submit.errors.photoType',
        );
      }

      const row = await insertSubmissionPhoto({
        submissionId: submission.id,
        ...stored,
        sortOrder: count,
      });
      return actionOk({ id: row.id });
    } finally {
      // The staging object has served its purpose whatever happened.
      await store.remove([parsedInput.uploadKey]).catch(() => undefined);
    }
  });

export const removeSubmissionPhoto = actionClient
  .metadata({ name: 'removeSubmissionPhoto' })
  .inputSchema(submissionTokenSchema.extend({ photoId: z.uuid() }))
  .action(async ({ parsedInput }): Promise<ActionResult<{ id: string }>> => {
    const submission = await openSubmission(parsedInput.token);
    if (!submission) return actionErr('forbidden', 'submit.errors.expired');

    const photo = await getSubmissionPhoto(parsedInput.photoId);
    if (!photo || photo.submissionId !== submission.id) {
      return actionErr('not_found', 'errors.notFound');
    }

    await deleteSubmissionPhotos([photo.id]);
    await privateStorage().remove(photoKeys(photo)).catch(() => undefined);
    return actionOk({ id: photo.id });
  });

export const submitSubmission = actionClient
  .metadata({ name: 'submitSubmission' })
  .inputSchema(submissionSchema)
  .action(async ({ parsedInput }): Promise<ActionResult<{ reference: number }>> => {
    const values = parsedInput as SubmissionValues;

    if (values.website) {
      // Silently accept so the bot has nothing to learn from the response.
      return actionOk({ reference: 0 });
    }

    const availability = await getLiveSubmissionAvailability();
    if (!availability.open) return actionErr('forbidden', 'submit.errors.closed');

    const ip = await clientIp();
    const ipHash = hashIp(ip);
    const [byIp, byEmail] = await Promise.all([
      checkRateLimit('submission:ip', ipHash),
      checkRateLimit('submission:email', values.email.toLowerCase()),
    ]);
    if (!byIp.success || !byEmail.success) {
      return actionErr('rate_limited', 'errors.rateLimited', {
        retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds),
      });
    }

    if (!(await verifyTurnstile(values.turnstileToken, ip, TURNSTILE_ACTION))) {
      return actionErr('forbidden', 'submit.errors.captcha');
    }

    // A visitor who added photos holds a handle on the row they started; one
    // who added none gets a row now (only possible when photos are optional).
    const open = values.token ? await openSubmission(values.token) : null;
    if (values.token && !open) return actionErr('forbidden', 'submit.errors.expired');

    // Keep exactly the photos the visitor still has on screen, in their order.
    const photos = open ? await listSubmissionPhotos(open.id) : [];
    const wanted = new Set(values.photoIds);
    const kept = values.photoIds.filter((id) => photos.some((photo) => photo.id === id));
    const dropped = photos.filter((photo) => !wanted.has(photo.id));
    if (kept.length < availability.settings.minPhotos) {
      return actionErr('validation', 'submit.errors.notEnoughPhotos', {
        minPhotos: availability.settings.minPhotos,
      });
    }

    const submissionId =
      open?.id ?? (await createIncompleteSubmission({ locale: values.locale, ipHash })).id;
    if (dropped.length > 0) {
      await deleteSubmissionPhotos(dropped.map((photo) => photo.id));
      await privateStorage()
        .remove(dropped.flatMap(photoKeys))
        .catch(() => undefined);
    }
    await setSubmissionPhotoOrder(submissionId, kept);

    const locationId = await resolveSubmittedPlace(values.cityId, values.districtId);
    const isRent = values.dealType === 'rent';
    const userAgent = (await headers()).get('user-agent')?.slice(0, 300) ?? null;

    const moved = await transitionSubmission(submissionId, ['incomplete'], {
      status: 'pending',
      dealType: values.dealType,
      propertyKind: values.propertyKind,
      locationId,
      locationText: values.locationText ?? null,
      address: values.address ?? null,
      price: values.price ?? null,
      currency: values.currency,
      area: values.area ?? null,
      landArea: values.landArea ?? null,
      rooms: values.rooms ?? null,
      bedrooms: values.bedrooms ?? null,
      bathrooms: values.bathrooms ?? null,
      floor: values.floor ?? null,
      floorsTotal: values.floorsTotal ?? null,
      yearBuilt: values.yearBuilt ?? null,
      constructionType: values.constructionType ?? null,
      heating: values.heating ?? null,
      furnishing: values.furnishing ?? null,
      condition: values.condition ?? null,
      featureKeys: values.featureKeys,
      maintenanceFee: isRent ? (values.maintenanceFee ?? null) : null,
      depositMonths: isRent ? (values.depositMonths ?? null) : null,
      availableFrom: isRent ? (values.availableFrom ?? null) : null,
      description: values.description,
      externalMediaUrl: values.externalMediaUrl ?? null,
      locale: values.locale,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      submitterRole: values.submitterRole,
      contactTime: values.contactTime ?? null,
      consentAt: new Date(),
      ipHash,
      userAgent,
      submittedAt: new Date(),
    });
    // Submitted twice (double click, two tabs): the first one won.
    if (!moved) return actionErr('conflict', 'submit.errors.expired');

    const submission = await getSubmission(submissionId);
    if (!submission) return actionErr('unexpected', 'errors.unexpected');

    after(async () => {
      const place = submission.locationId ? await getSubmissionPlace(submission.locationId) : null;
      const placeName = place
        ? [place.nameEn, place.parentNameEn].filter(Boolean).join(', ')
        : null;
      await notifyOfficeOfSubmission(submission, { placeName, photoCount: kept.length });
      await sendSubmissionReceipt(submission);
    });

    return actionOk({ reference: submission.reference });
  });
