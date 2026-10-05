import type { MediaVariant } from '@/lib/domain/media';
import { fallbackSrc, srcSetFor } from '@/lib/media-url';
import { cn } from '@/lib/utils';

/**
 * Renders a pre-generated image ladder.
 *
 * A plain `<picture>` is used rather than `next/image` on purpose: the
 * derivatives already exist as immutable objects in storage, so routing them
 * through a runtime optimiser would add latency and a per-image cost for no
 * benefit. Ships zero JavaScript.
 *
 * Intrinsic `width`/`height` are always emitted so the browser can reserve the
 * exact box before the bytes arrive — the difference between a CLS of 0 and a
 * failing Core Web Vitals score on an image-heavy page.
 */
export function ResponsiveImage({
  variants,
  width,
  height,
  alt,
  sizes,
  blurDataUrl,
  priority = false,
  className,
  imageClassName,
}: {
  variants: readonly MediaVariant[];
  width: number;
  height: number;
  alt: string;
  sizes: string;
  blurDataUrl?: string | null;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const src = fallbackSrc(variants);
  if (!src) return <div className={cn('bg-surface-sunken', className)} aria-hidden="true" />;

  return (
    <picture
      className={cn('block overflow-hidden bg-surface-sunken', className)}
      style={
        blurDataUrl
          ? { backgroundImage: `url("${blurDataUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined
      }
    >
      <source type="image/avif" srcSet={srcSetFor(variants, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSetFor(variants, 'webp')} sizes={sizes} />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        // The hero image of a listing is the LCP element; telling the browser
        // to fetch it at high priority measurably improves that metric.
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={cn('h-full w-full object-cover', imageClassName)}
      />
    </picture>
  );
}
