'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveImage } from '@/components/media/responsive-image';
import type { ListingCardDto } from '@/features/listings/dto';
import type { Locale } from '@/i18n/routing';
import { hasIndoorArea } from '@/lib/domain/enums';
import { formatArea, formatNumber, formatPrice, formatPricePerSqm } from '@/lib/format';
import { listingPath, searchPath } from '@/lib/routes';
import { MAX_COMPARE, useFavorites } from '../store';
import { useFavoriteListings } from '../use-favorite-listings';

/**
 * Side-by-side comparison of saved properties.
 *
 * A horizontally scrollable table with a sticky label column: rows are
 * attributes, columns are properties, which is the layout people can actually
 * read across. Capped at a handful of columns because beyond that nobody can.
 */
export function CompareView() {
  const t = useTranslations('compare');
  const tListing = useTranslations('listing');
  const tEnum = useTranslations('enums');
  const locale = useLocale() as Locale;
  const { ids, remove } = useFavorites();

  const comparedIds = ids.slice(0, MAX_COMPARE);
  const state = useFavoriteListings(locale, comparedIds);

  const rows: { label: string; render: (listing: ListingCardDto) => string }[] = [
    {
      label: tListing('reference'),
      render: (listing) => String(listing.reference),
    },
    {
      label: tEnum('dealType.sale').replace(/.*/, tListing('overview')),
      render: (listing) => tEnum(`propertyKind.${listing.kind}`),
    },
    {
      label: tListing('totalArea'),
      render: (listing) => {
        const area = hasIndoorArea(listing.kind) ? listing.area : listing.landArea;
        return area ? formatArea(locale, area) : '—';
      },
    },
    {
      label: tListing('pricePerSqm'),
      render: (listing) =>
        listing.price?.perSqmEur ? formatPricePerSqm(locale, listing.price.perSqmEur) : '—',
    },
    {
      label: tListing('rooms'),
      render: (listing) => (listing.rooms ? formatNumber(locale, listing.rooms) : '—'),
    },
    {
      label: tListing('bedrooms'),
      render: (listing) => (listing.bedrooms ? formatNumber(locale, listing.bedrooms) : '—'),
    },
    {
      label: tListing('floor'),
      render: (listing) =>
        listing.floor !== null
          ? listing.floorsTotal
            ? tListing('floorOf', { floor: listing.floor, total: listing.floorsTotal })
            : String(listing.floor)
          : '—',
    },
    {
      label: tListing('location'),
      render: (listing) => [listing.city?.name, listing.district?.name].filter(Boolean).join(', ') || '—',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('title')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t('subtitle', { max: MAX_COMPARE })}</p>

      {ids.length > MAX_COMPARE ? (
        <p className="mt-4">
          <Badge tone="warning">{t('limitReached', { max: MAX_COMPARE })}</Badge>
        </p>
      ) : null}

      {state.status === 'loading' || state.status === 'idle' ? (
        comparedIds.length > 0 ? <Skeleton className="mt-8 h-96 w-full" /> : null
      ) : null}

      {state.status === 'ready' && state.items.length < 2 ? (
        <div className="mt-8 rounded-card border border-dashed border-line-strong bg-surface p-12 text-center">
          <p className="text-ink-muted">{t('empty')}</p>
          <Button asChild className="mt-6">
            <Link href={searchPath(locale, { deal: 'sale' })}>{tListing('similar')}</Link>
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && state.items.length >= 2 ? (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <caption className="sr-only">{t('title')}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-40 bg-canvas p-3 text-left align-bottom" />
                {state.items.map((listing) => (
                  <th key={listing.id} scope="col" className="min-w-56 p-3 align-bottom">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => remove(listing.id)}
                        aria-label={t('remove')}
                        className="absolute right-1 top-1 z-10 grid size-7 place-items-center rounded-full bg-surface/90 text-ink-muted hover:text-danger"
                      >
                        <X className="size-4" />
                      </button>
                      {listing.cover ? (
                        <ResponsiveImage
                          variants={listing.cover.variants}
                          width={listing.cover.width}
                          height={listing.cover.height}
                          blurDataUrl={listing.cover.blurDataUrl}
                          alt={listing.title}
                          sizes="240px"
                          className="aspect-[4/3] w-full rounded-lg"
                        />
                      ) : (
                        <div className="aspect-[4/3] w-full rounded-lg bg-surface-sunken" />
                      )}
                      <Link
                        href={listingPath(locale, listing.slug)}
                        className="mt-2 block text-left font-medium text-ink hover:text-brand"
                      >
                        {listing.title}
                      </Link>
                      <p className="mt-1 text-left text-lg font-semibold text-ink">
                        {listing.price
                          ? formatPrice(locale, listing.price.amount, listing.price.currency)
                          : tListing('priceOnRequest')}
                      </p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.label} className={index % 2 === 0 ? 'bg-surface-muted/60' : undefined}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-inherit p-3 text-left font-medium text-ink-muted"
                  >
                    {row.label}
                  </th>
                  {state.items.map((listing) => (
                    <td key={listing.id} className="p-3 text-ink">
                      {row.render(listing)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
