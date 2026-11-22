/**
 * Image derivatives are generated once at upload time and stored under
 * content-hashed keys. Nothing is resized at request time, so serving cost and
 * latency stay constant no matter how much traffic or how many listings exist.
 */

/** Widths rendered for every uploaded photo, chosen to cover the grid, the
 *  detail hero and full-screen viewing on a 2× display. */
export const derivativeWidths = [320, 640, 1024, 1600] as const;
export type DerivativeWidth = (typeof derivativeWidths)[number];

export const derivativeFormats = ['avif', 'webp'] as const;
export type DerivativeFormat = (typeof derivativeFormats)[number];

export type MediaVariant = {
  readonly width: DerivativeWidth;
  readonly height: number;
  readonly format: DerivativeFormat;
  readonly key: string;
  readonly bytes: number;
};

/**
 * Denormalised snapshot of a listing's first photo.
 *
 * Listing grids are the hottest query in the app; keeping the cover inline means
 * rendering a page of results never joins the media table. The media use case is
 * the single writer, so the copy cannot drift.
 */
export type CoverImage = {
  readonly mediaId: string;
  readonly width: number;
  readonly height: number;
  readonly blurDataUrl: string | null;
  readonly variants: readonly MediaVariant[];
};

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export function isAcceptedImageType(value: string): value is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(value);
}

/**
 * Photos sent with a visitor's property submission.
 *
 * The browser shrinks each photo to `SUBMISSION_PHOTO_MAX_EDGE` before upload,
 * so the server-side byte cap only matters when that step is unavailable.
 * The shorter-edge floor rejects thumbnails and screenshots of thumbnails,
 * which would look broken in the listing gallery.
 */
export const MAX_SUBMISSION_PHOTOS = 30;
export const SUBMISSION_PHOTO_MAX_EDGE = 2560;
export const SUBMISSION_PHOTO_MIN_EDGE = 600;
