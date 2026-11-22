import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  derivativeFormats,
  derivativeWidths,
  type DerivativeFormat,
  type MediaVariant,
} from '@/lib/domain/media';
import type { StorageAdapter } from '@/server/adapters/storage';

/**
 * Derivative generation.
 *
 * Every uploaded photo is converted once into a fixed ladder of widths and
 * formats, written under content-hashed keys, and then served directly from the
 * CDN with an immutable cache header. Nothing is transformed per request, so
 * image cost is a function of how many photos exist rather than how much traffic
 * the site gets — the single biggest lever on this project's running costs.
 */

export type ProcessedImage = {
  readonly hash: string;
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly contentType: string;
  readonly blurDataUrl: string;
  readonly variants: MediaVariant[];
};

const QUALITY: Record<DerivativeFormat, number> = { avif: 52, webp: 76 };
/** Largest edge kept for the stored original; anything beyond is wasted bytes. */
const ORIGINAL_MAX_EDGE = 2400;
const BLUR_WIDTH = 16;

function contentTypeFor(format: DerivativeFormat): string {
  return format === 'avif' ? 'image/avif' : 'image/webp';
}

function hashOf(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 20);
}

/**
 * Keys are content-addressed rather than listing-scoped. Uploading the same
 * photo to two listings therefore stores one copy, and because the key can never
 * describe different bytes, the CDN can cache it permanently.
 */
export function derivativeKey(hash: string, width: number, format: DerivativeFormat): string {
  return `media/${hash}/${width}.${format}`;
}

export function originalKey(hash: string, extension: string): string {
  return `media/${hash}/original.${extension}`;
}

/**
 * Reads an uploaded image, normalises it, and writes every derivative.
 *
 * `sharp` handles EXIF rotation and strips metadata, which both fixes sideways
 * phone photos and removes GPS coordinates that would otherwise leak a seller's
 * address through an image file.
 */
export async function processImage(
  storage: StorageAdapter,
  input: Buffer,
): Promise<ProcessedImage> {
  // No `withMetadata()`: sharp strips EXIF/XMP/IPTC by default, and
  // `withMetadata()` would copy all of it — GPS included — into the stored
  // original, which shares its content hash (and so its URL prefix) with the
  // public derivatives.
  const normalized = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await normalized.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unsupported image: dimensions could not be determined.');
  }

  const originalBuffer = await normalized
    .clone()
    .resize({
      width: ORIGINAL_MAX_EDGE,
      height: ORIGINAL_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const hash = hashOf(originalBuffer.data);
  const storageKey = originalKey(hash, 'jpg');

  await storage.put(storageKey, originalBuffer.data, {
    contentType: 'image/jpeg',
    immutable: true,
  });

  const variants: MediaVariant[] = [];

  for (const width of derivativeWidths) {
    // Never upscale: a 900px original should not produce a blurry 1600px file.
    if (width > originalBuffer.info.width && width !== derivativeWidths[0]) continue;

    for (const format of derivativeFormats) {
      const resized = sharp(originalBuffer.data).resize({
        width,
        withoutEnlargement: true,
      });

      const output = await (format === 'avif'
        ? resized.avif({ quality: QUALITY.avif, effort: 4 })
        : resized.webp({ quality: QUALITY.webp })
      ).toBuffer({ resolveWithObject: true });

      const key = derivativeKey(hash, width, format);
      await storage.put(key, output.data, { contentType: contentTypeFor(format), immutable: true });

      variants.push({
        width,
        height: output.info.height,
        format,
        key,
        bytes: output.data.length,
      });
    }
  }

  const blur = await sharp(originalBuffer.data)
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    hash,
    storageKey,
    width: originalBuffer.info.width,
    height: originalBuffer.info.height,
    bytes: originalBuffer.data.length,
    contentType: 'image/jpeg',
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
    variants,
  };
}

/** Every object belonging to a processed image, for cleanup on delete. */
export function keysOf(storageKey: string, variants: readonly MediaVariant[]): string[] {
  return [storageKey, ...variants.map((variant) => variant.key)];
}
