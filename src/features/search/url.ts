import type { Locale } from '@/i18n/routing';
import type { PropertyKind } from '@/lib/domain/enums';
import { searchPath, withQuery } from '@/lib/routes';
import { serializeSearchFilters } from './params';
import type { SearchFilters } from './types';

/**
 * The one function that turns a search into a URL.
 *
 * A single rule decides where a filter lives, and it exists here rather than
 * being re-derived by the filter panel, the removable chips, the canonical tag
 * and the RSS feed:
 *
 *   exactly one property kind selected → it belongs in the path, because
 *   `/bg/prodazhba/apartamenti/sofia` is a page worth ranking;
 *   zero or several                    → the query string carries them, and
 *   the page is marked `noindex`.
 *
 * Without this rule the same result set would be reachable at two addresses,
 * which is the classic way a filtered catalogue leaks duplicate content.
 */
export type SearchScope = {
  readonly deal: SearchFilters['dealType'];
  readonly citySlug?: string;
  readonly districtSlug?: string;
};

export function buildSearchUrl(
  locale: Locale,
  scope: SearchScope,
  filters: SearchFilters,
  extra?: Readonly<Record<string, string | undefined>>,
): string {
  const singleKind: PropertyKind | undefined =
    filters.kinds.length === 1 ? filters.kinds[0] : undefined;

  const path = searchPath(locale, {
    deal: scope.deal,
    kind: singleKind,
    citySlug: scope.citySlug,
    districtSlug: scope.districtSlug,
  });

  const query = serializeSearchFilters(filters);
  if (singleKind) query.delete('kinds');

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) query.set(key, value);
  }

  return withQuery(path, query);
}

/** Depth of the crawlable path, used to decide whether a page is indexable. */
export function scopeDepth(scope: SearchScope, filters: SearchFilters): number {
  return (
    1 +
    (filters.kinds.length === 1 ? 1 : 0) +
    (scope.citySlug ? 1 : 0) +
    (scope.districtSlug ? 1 : 0)
  );
}
