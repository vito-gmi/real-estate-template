'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, GitCompareArrows, Link2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ListingCardSkeleton } from '@/features/listings/components/listing-card';
import { ListingCard } from '@/features/listings/components/listing-card';
import type { Locale } from '@/i18n/routing';
import { searchPath, staticPath } from '@/lib/routes';
import { decodeFavoriteIds, encodeFavoriteIds } from '../share';
import { useFavorites } from '../store';
import { useFavoriteListings } from '../use-favorite-listings';

/**
 * The saved-properties page.
 *
 * The list is device-local, so this is rendered on the client. A shared list
 * arrives as `?s=<packed ids>` and is shown as a separate, additive proposal
 * rather than silently merged — overwriting someone's own shortlist because
 * they opened a friend's link would be a hostile surprise.
 */
export function FavoritesView() {
  const t = useTranslations('favorites');
  const tNav = useTranslations('nav');
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const { ids, clear, add } = useFavorites();

  const sharedIds = useMemo(() => decodeFavoriteIds(searchParams.get('s')), [searchParams]);
  const [importedShared, setImportedShared] = useState(false);

  const state = useFavoriteListings(locale, ids);
  const [copied, setCopied] = useState(false);

  useEffect(() => setCopied(false), [ids.length]);

  async function copyShareLink() {
    const url = new URL(window.location.href);
    url.search = `s=${encodeFavoriteIds(ids)}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      // Clipboard permission denied; the button simply does nothing visible.
    }
  }

  const pendingShared = sharedIds.filter((id) => !ids.includes(id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('subtitle')}</p>
        </div>

        {ids.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              {copied ? <Check /> : <Link2 />}
              {copied ? t('shareList') : t('shareList')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={staticPath('compare', locale)}>
                <GitCompareArrows />
                {tNav('compare')}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={clear}>
              <Trash2 />
              {t('clear')}
            </Button>
          </div>
        ) : null}
      </div>

      {pendingShared.length > 0 && !importedShared ? (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-card border border-brand/30 bg-brand-soft p-4">
          <div>
            <p className="text-sm font-semibold text-brand">{t('importedTitle')}</p>
            <p className="text-sm text-ink-muted">
              {t('importedText', { count: pendingShared.length })}
            </p>
          </div>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => {
              add(pendingShared);
              setImportedShared(true);
            }}
          >
            {t('importAction')}
          </Button>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-ink-muted" aria-live="polite">
        {t('count', { count: ids.length })}
      </p>

      <div className="mt-8">
        {ids.length > 0 && (state.status === 'loading' || state.status === 'idle') ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: Math.min(ids.length, 6) }, (_, index) => (
              <li key={index}>
                <ListingCardSkeleton />
              </li>
            ))}
          </ul>
        ) : null}

        {state.status === 'error' ? (
          <div className="rounded-card border border-dashed border-line-strong bg-surface p-12 text-center">
            <h2 className="text-lg font-semibold text-ink">{t('loadError')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{t('loadErrorText')}</p>
          </div>
        ) : null}

        {state.status === 'ready' && state.items.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-surface p-12 text-center">
            <h2 className="text-lg font-semibold text-ink">{t('empty')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{t('emptyText')}</p>
            <Button asChild className="mt-6">
              <Link href={searchPath(locale, { deal: 'sale' })}>{t('browse')}</Link>
            </Button>
          </div>
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {state.items.map((listing) => (
              <li key={listing.id}>
                <ListingCard locale={locale} listing={listing} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-10 text-xs text-ink-subtle">{t('storedLocally')}</p>
    </div>
  );
}
