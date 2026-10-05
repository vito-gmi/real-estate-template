'use client';

import { useCallback, useId, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ResponsiveImage } from '@/components/media/responsive-image';
import { cn } from '@/lib/utils';
import type { ListingPhotoDto } from '../dto';

const HERO_SIZES = '(min-width: 1024px) 62vw, 100vw';
const THUMB_SIZES = '120px';
const FULL_SIZES = '100vw';

/**
 * Listing gallery.
 *
 * The first photo is rendered eagerly at high priority because it is the page's
 * Largest Contentful Paint element; every other photo is lazy. The full-screen
 * viewer is a native popover so iOS Safari can open it without a React `click`
 * handler — the same approach that made the language switcher work on a phone.
 */
export function Gallery({ photos, title }: { photos: readonly ListingPhotoDto[]; title: string }) {
  const t = useTranslations('listing');
  const tCommon = useTranslations('common');
  const [active, setActive] = useState(0);
  const viewerId = `gallery-${useId().replaceAll(':', '')}`;

  const count = photos.length;

  const go = useCallback(
    (delta: number) => setActive((current) => (current + delta + count) % count),
    [count],
  );

  if (count === 0) {
    return (
      <div className="grid aspect-[16/10] w-full place-items-center rounded-card bg-surface-sunken text-ink-subtle">
        <ImageOff className="size-10" aria-hidden="true" />
        <span className="sr-only">{t('noPhoto')}</span>
      </div>
    );
  }

  const current = photos[active]!;

  return (
    <div>
      <div className="relative overflow-hidden rounded-card bg-surface-sunken">
        <button
          type="button"
          className="block w-full cursor-zoom-in touch-manipulation"
          aria-label={t('openGallery')}
          popoverTarget={viewerId}
        >
          <ResponsiveImage
            variants={current.variants}
            width={current.width}
            height={current.height}
            blurDataUrl={current.blurDataUrl}
            alt={current.alt}
            sizes={HERO_SIZES}
            priority={active === 0}
            className="aspect-[16/10] w-full"
          />
        </button>

        {count > 1 ? (
          <>
            <GalleryArrow side="left" label={t('previousImage')} onClick={() => go(-1)} />
            <GalleryArrow side="right" label={t('nextImage')} onClick={() => go(1)} />
          </>
        ) : null}

        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-medium text-white">
          <Expand className="size-3.5" aria-hidden="true" />
          {t('imageCounter', { current: active + 1, total: count })}
        </div>
      </div>

      {count > 1 ? (
        <ul className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={t('imageCounter', { current: index + 1, total: count })}
                aria-current={index === active}
                className={cn(
                  'overflow-hidden rounded-lg border-2 touch-manipulation transition-colors',
                  index === active ? 'border-brand' : 'border-transparent hover:border-line-strong',
                )}
              >
                <ResponsiveImage
                  variants={photo.variants}
                  width={photo.width}
                  height={photo.height}
                  blurDataUrl={photo.blurDataUrl}
                  alt=""
                  sizes={THUMB_SIZES}
                  className="h-20 w-28"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div id={viewerId} popover="auto" className="gallery-popover" role="dialog" aria-label={title}>
        <button
          type="button"
          className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white touch-manipulation hover:bg-white/20"
          popoverTarget={viewerId}
          popoverTargetAction="hide"
          aria-label={tCommon('close')}
        >
          <X className="size-5" />
        </button>
        <div className="relative flex size-full flex-col items-center justify-center">
          <ResponsiveImage
            variants={current.variants}
            width={current.width}
            height={current.height}
            alt={current.alt}
            sizes={FULL_SIZES}
            className="max-h-[85dvh] w-auto max-w-full bg-transparent"
            imageClassName="object-contain"
          />
          {count > 1 ? (
            <>
              <GalleryArrow side="left" label={t('previousImage')} onClick={() => go(-1)} inverted />
              <GalleryArrow side="right" label={t('nextImage')} onClick={() => go(1)} inverted />
            </>
          ) : null}
          <p className="mt-3 text-center text-sm text-white/80">
            {t('imageCounter', { current: active + 1, total: count })}
          </p>
        </div>
      </div>
    </div>
  );
}

function GalleryArrow({
  side,
  label,
  onClick,
  inverted = false,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
  inverted?: boolean;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full touch-manipulation transition-colors',
        side === 'left' ? 'left-3' : 'right-3',
        inverted ? 'bg-white/10 text-white hover:bg-white/25' : 'bg-surface/85 text-ink hover:bg-surface',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
