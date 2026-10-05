import { clientEnv } from '@/env';
import type { DerivativeFormat, MediaVariant } from './domain/media';

/** Resolves a storage key to its public, CDN-facing URL. */
export function mediaUrl(key: string): string {
  return `${clientEnv.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '')}/${key}`;
}

/**
 * Builds a `srcset` for one format.
 *
 * Because the derivative widths were fixed at upload time, the browser gets a
 * complete, honest set of candidates and picks the smallest file that satisfies
 * the layout — no runtime resizing service in the path.
 */
export function srcSetFor(variants: readonly MediaVariant[], format: DerivativeFormat): string {
  return variants
    .filter((variant) => variant.format === format)
    .sort((a, b) => a.width - b.width)
    .map((variant) => `${mediaUrl(variant.key)} ${variant.width}w`)
    .join(', ');
}

/** Widest WebP variant, used as the universally supported `<img src>`. */
export function fallbackSrc(variants: readonly MediaVariant[]): string | null {
  const webp = variants
    .filter((variant) => variant.format === 'webp')
    .sort((a, b) => b.width - a.width);
  const chosen = webp[0] ?? variants[0];
  return chosen ? mediaUrl(chosen.key) : null;
}
