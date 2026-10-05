import 'server-only';

import type { Locale } from '@/i18n/routing';
import type { DealType } from '@/lib/domain/enums';
import { cacheTags, cacheTtl, cached } from '@/server/cache';
import * as featuresRepo from '@/server/repositories/features';
import * as listingsRepo from '@/server/repositories/listings';
import * as locationsRepo from '@/server/repositories/locations';
import type { SearchFilters } from '@/features/search/types';

/**
 * Read use cases.
 *
 * Routes call these rather than the repositories directly: this is the layer
 * that decides what is cached, for how long, and under which tags. Keeping that
 * decision out of both the route and the SQL means caching can be tuned without
 * touching either.
 */

export const searchListings = cached(
  (locale: Locale, filters: SearchFilters, cursor: string | undefined, limit: number) =>
    listingsRepo.searchListings(locale, filters, { cursor, limit }),
  ['listings', 'search'],
  { tags: [cacheTags.listings], revalidate: cacheTtl.search },
);

export const countListings = cached(
  (locale: Locale, filters: SearchFilters) => listingsRepo.countListings(locale, filters),
  ['listings', 'count'],
  { tags: [cacheTags.listings], revalidate: cacheTtl.search },
);

export const getFacets = cached(
  (dealType: DealType, scope: { regionId?: string; cityId?: string }) =>
    listingsRepo.getFacets(dealType, scope),
  ['listings', 'facets'],
  { tags: [cacheTags.facets], revalidate: cacheTtl.facets },
);

export const getShowcaseListings = cached(
  (locale: Locale, options: { featuredOnly?: boolean; dealType?: DealType; limit?: number }) =>
    listingsRepo.getShowcaseListings(locale, options),
  ['listings', 'showcase'],
  { tags: [cacheTags.listings], revalidate: cacheTtl.search },
);

export const getListingBySlug = cached(
  (locale: Locale, slug: string) => listingsRepo.getListingBySlug(locale, slug),
  ['listings', 'detail'],
  { tags: [cacheTags.listings], revalidate: cacheTtl.detail },
);

/**
 * Uncached reads used only for signed draft-preview links. Caching a draft would
 * either leak it after publish-state changes or serve a stale 404.
 */
export const getListingBySlugUncached = listingsRepo.getListingBySlug;
export const getListingByIdUncached = listingsRepo.getListingById;

export const getSimilarListings = cached(
  (locale: Locale, reference: listingsRepo.ListingDetailResult['internal'], limit: number) =>
    listingsRepo.getSimilarListings(locale, reference, limit),
  ['listings', 'similar'],
  { tags: [cacheTags.listings], revalidate: cacheTtl.detail },
);

export const getLocationTree = cached(
  (locale: Locale) => locationsRepo.getLocationTree(locale),
  ['taxonomy', 'locations'],
  { tags: [cacheTags.taxonomy], revalidate: cacheTtl.taxonomy },
);

export const getPopularCities = cached(
  (locale: Locale, limit: number) => locationsRepo.getPopularCities(locale, limit),
  ['taxonomy', 'popular-cities'],
  { tags: [cacheTags.taxonomy, cacheTags.facets], revalidate: cacheTtl.facets },
);

export const listFilterableFeatures = cached(
  (locale: Locale) => featuresRepo.listFilterableFeatures(locale),
  ['taxonomy', 'features'],
  { tags: [cacheTags.taxonomy], revalidate: cacheTtl.taxonomy },
);

/**
 * Not cached: resolving URL segments must reflect a renamed district at once,
 * and it is a single indexed lookup.
 */
export const resolveLocationSegments = locationsRepo.resolveLocationSegments;

/** Favourites are per-visitor, so this read is never cached. */
export const getListingCardsByIds = listingsRepo.getListingCardsByIds;

export const listPublishedSlugs = listingsRepo.listPublishedSlugs;
export const countPublishedListings = listingsRepo.countPublishedListings;
