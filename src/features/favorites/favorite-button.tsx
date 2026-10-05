'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useIsFavorite, useFavorites } from './store';

/**
 * The heart toggle.
 *
 * iOS Safari does not reliably fire `click` on a `<button>`, and it also fails
 * to toggle a `sr-only` checkbox via its `<label>` — the tap falls through to
 * whatever is underneath. The actual checkbox fills this 44px target (see
 * `.native-hit`) so Safari hits the input directly. The icon follows `:checked`
 * in CSS as well as React state, so the heart fills even before the store updates.
 */
export function FavoriteButton({
  listingId,
  variant = 'overlay',
  className,
}: {
  listingId: string;
  variant?: 'overlay' | 'inline';
  className?: string;
}) {
  const t = useTranslations('listing');
  const isFavorite = useIsFavorite(listingId);
  const { toggle } = useFavorites();

  const label = isFavorite ? t('removeFromFavorites') : t('addToFavorites');

  return (
    <label
      title={label}
      className={cn(
        'relative isolate z-20 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full touch-manipulation',
        variant === 'overlay'
          ? 'bg-white text-ink shadow-card'
          : 'border border-line-strong bg-white text-ink shadow-xs',
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer native-hit"
        checked={isFavorite}
        onChange={() => toggle(listingId)}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
      />
      <Heart
        className={cn(
          'pointer-events-none relative z-0 size-5 transition-[fill,color,transform] duration-200',
          'peer-checked:fill-danger peer-checked:text-danger peer-checked:scale-110',
          isFavorite ? 'fill-danger text-danger' : 'fill-transparent text-ink',
        )}
      />
    </label>
  );
}
