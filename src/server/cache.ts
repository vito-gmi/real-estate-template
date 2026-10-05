import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';

/**
 * Cache tags and TTLs in one place.
 *
 * Two mechanisms are combined deliberately: a time-based revalidate window that
 * bounds staleness even if an invalidation is ever missed, and tag invalidation
 * that makes an editor's change appear immediately. A page therefore keeps
 * serving from cache during a database outage instead of returning a 500 —
 * which is most of how this site stays available.
 */

export const cacheTags = {
  /** Anything that changes the set or ordering of public listings. */
  listings: 'listings',
  listing: (id: string) => `listing:${id}`,
  facets: 'facets',
  /** Locations and features — edited rarely, read on every page. */
  taxonomy: 'taxonomy',
} as const;

export const cacheTtl = {
  search: 300,
  detail: 900,
  facets: 600,
  taxonomy: 3600,
} as const;

type CacheOptions = {
  readonly tags: readonly string[];
  readonly revalidate: number;
};

/**
 * Thin wrapper over `unstable_cache` so call sites read declaratively and the
 * "which tags does this depend on" decision is visible at the definition.
 */
export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: CacheOptions,
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, keyParts, {
    tags: [...options.tags],
    revalidate: options.revalidate,
  });
}

/**
 * Called after any admin write that changes what visitors can see.
 *
 * `expire: 0` drops the entry immediately rather than merely marking it stale,
 * so an agent who publishes a listing sees it live on the next request instead
 * of on the next revalidation window.
 */
const IMMEDIATE = { expire: 0 } as const;

export function revalidateListingCaches(listingId?: string): void {
  revalidateTag(cacheTags.listings, IMMEDIATE);
  revalidateTag(cacheTags.facets, IMMEDIATE);
  if (listingId) revalidateTag(cacheTags.listing(listingId), IMMEDIATE);
}

export function revalidateTaxonomyCaches(): void {
  revalidateTag(cacheTags.taxonomy, IMMEDIATE);
}
