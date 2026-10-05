'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useFavoriteCount } from './store';

/** Header entry point, with a count badge that appears once something is saved. */
export function FavoritesLink({ href, className }: { href: string; className?: string }) {
  const t = useTranslations('nav');
  const count = useFavoriteCount();

  return (
    <a
      href={href}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-ink-muted touch-manipulation transition-colors hover:bg-surface-muted hover:text-ink',
        className,
      )}
    >
      <span className="relative">
        <Heart className={cn('size-5', count > 0 && 'fill-danger text-danger')} />
        {count > 0 ? (
          <span className="absolute -right-2 -top-2 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </span>
      <span className="hidden lg:inline">{t('favorites')}</span>
    </a>
  );
}
