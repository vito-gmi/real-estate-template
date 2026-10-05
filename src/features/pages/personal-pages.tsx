import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Skeleton } from '@/components/ui/skeleton';
import { CompareView } from '@/features/favorites/components/compare-view';
import { FavoritesView } from '@/features/favorites/components/favorites-view';
import type { Locale } from '@/i18n/routing';
import { guardSegmentLocale } from './simple-page';

/**
 * Favourites and comparison.
 *
 * Both are personal to the device, so they are `noindex` — there is nothing for
 * a crawler to find and a shared shortlist should not end up in search results.
 * The server component exists only to enforce the canonical locale segment; the
 * content itself renders on the client from `localStorage`.
 */

export function personalPageMetadata(namespace: 'favorites' | 'compare', segmentLocale: Locale) {
  return async ({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> => {
    const { locale } = await params;
    if (locale !== segmentLocale) return {};
    const t = await getTranslations({ locale, namespace });
    return {
      title: t('title'),
      robots: { index: false, follow: true },
    };
  };
}

export async function FavoritesPage({
  params,
  segmentLocale,
}: {
  params: Promise<{ locale: Locale }>;
  segmentLocale: Locale;
}) {
  await guardSegmentLocale('favorites', segmentLocale, params);
  return (
    <Suspense fallback={<PersonalPageFallback />}>
      <FavoritesView />
    </Suspense>
  );
}

export async function ComparePage({
  params,
  segmentLocale,
}: {
  params: Promise<{ locale: Locale }>;
  segmentLocale: Locale;
}) {
  await guardSegmentLocale('compare', segmentLocale, params);
  return (
    <Suspense fallback={<PersonalPageFallback />}>
      <CompareView />
    </Suspense>
  );
}

function PersonalPageFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
