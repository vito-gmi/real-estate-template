import 'server-only';

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { SUBMISSION_PHOTO_MIN_EDGE } from '@/lib/domain/media';
import type { StorageAdapter } from '@/server/adapters/storage';

/**
 * Photos sent with a property submission.
 *
 * Every upload is decoded and re-encoded before anyone sees it: a file sharp
 * cannot decode is not an image whatever its name says, re-encoding drops
 * anything smuggled after the image data, and metadata (GPS included) is
 * stripped so an owner's location does not travel with their photos. The
 * reviewer gets a small thumbnail; the full JPEG is what approval turns into
 * public derivatives.
 */

/** Matches the public pipeline's stored original, so approval loses nothing. */
const STORED_MAX_EDGE = 2400;
const THUMB_WIDTH = 480;

export class PhotoTooSmallError extends Error {
  constructor() {
    super('Photo is below the minimum size.');
  }
}

/** Every object for a submission lives under this prefix. */
export function submissionKeyPrefix(submissionId: string): string {
  return `submissions/${submissionId}/`;
}

/** Where the browser uploads before the server has looked at the bytes. */
export function stagingKey(submissionId: string): string {
  return `${submissionKeyPrefix(submissionId)}staging/${randomUUID()}`;
}

/** A staging key the server issued for this submission, and nothing else. */
export function isStagingKeyFor(submissionId: string, key: string): boolean {
  const prefix = `${submissionKeyPrefix(submissionId)}staging/`;
  return key.startsWith(prefix) && /^[0-9a-f-]{36}$/.test(key.slice(prefix.length));
}

export type StoredSubmissionPhoto = {
  readonly storageKey: string;
  readonly thumbKey: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
};

export async function storeSubmissionPhoto(
  store: StorageAdapter,
  submissionId: string,
  input: Buffer,
): Promise<StoredSubmissionPhoto> {
  // `failOn: 'error'` rejects truncated or corrupt files; sharp's default
  // pixel limit already refuses decompression bombs.
  const image = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unsupported image: dimensions could not be determined.');
  }
  // Orientation does not matter for this check, so the pre-rotation
  // dimensions sharp reports are fine.
  if (Math.min(metadata.width, metadata.height) < SUBMISSION_PHOTO_MIN_EDGE) {
    throw new PhotoTooSmallError();
  }

  const full = await image
    .clone()
    .resize({
      width: STORED_MAX_EDGE,
      height: STORED_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const thumb = await sharp(full.data)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const id = randomUUID();
  const storageKey = `${submissionKeyPrefix(submissionId)}${id}.jpg`;
  const thumbKey = `${submissionKeyPrefix(submissionId)}${id}-thumb.webp`;

  await store.put(storageKey, full.data, { contentType: 'image/jpeg' });
  await store.put(thumbKey, thumb, { contentType: 'image/webp' });

  return {
    storageKey,
    thumbKey,
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.length,
  };
}

/** Both objects behind a stored photo, for deletion. */
export function photoKeys(photo: { storageKey: string; thumbKey: string }): string[] {
  return [photo.storageKey, photo.thumbKey];
}
