import type { Locale } from '@/i18n/routing';
import { dealTypeSlugs, propertyKindSlugs, type DealType, type PropertyKind } from './domain/enums';

/**
 * Every public URL is built here.
 *
 * Static path segments are translated so Bulgarian visitors get Bulgarian URLs
 * (`/bg/imot/...`) and English visitors get English ones (`/en/property/...`),
 * which is worth real SEO points in the local market. Because nothing else in
 * the app concatenates paths by hand, renaming a segment is a one-line change.
 */

export const staticRouteKeys = [
  'detail',
  'favorites',
  'compare',
  'contact',
  'about',
  'privacy',
  'terms',
] as const;

export type StaticRouteKey = (typeof staticRouteKeys)[number];

export const staticRouteSlugs: Readonly<Record<StaticRouteKey, Readonly<Record<Locale, string>>>> = {
  detail: { bg: 'imot', en: 'property' },
  favorites: { bg: 'favoriti', en: 'favorites' },
  compare: { bg: 'sravnenie', en: 'compare' },
  contact: { bg: 'kontakti', en: 'contact' },
  about: { bg: 'za-nas', en: 'about' },
  privacy: { bg: 'poveritelnost', en: 'privacy' },
  terms: { bg: 'usloviya', en: 'terms' },
};

export function routeSlug(key: StaticRouteKey, locale: Locale): string {
  return staticRouteSlugs[key][locale];
}

export function staticPath(key: StaticRouteKey, locale: Locale): string {
  return `/${locale}/${routeSlug(key, locale)}`;
}

export function homePath(locale: Locale): string {
  return `/${locale}`;
}

export function listingPath(locale: Locale, slug: string): string {
  return `${staticPath('detail', locale)}/${slug}`;
}

export type SearchPathSegments = {
  readonly deal: DealType;
  readonly kind?: PropertyKind;
  readonly citySlug?: string;
  readonly districtSlug?: string;
};

/**
 * Builds the crawlable part of a search URL. Filters that do not belong in the
 * path (price, area, rooms, sorting, cursor) stay in the query string, which is
 * what keeps the indexable surface small and predictable.
 */
export function searchPath(locale: Locale, segments: SearchPathSegments): string {
  const parts: string[] = [locale, dealTypeSlugs[segments.deal][locale]];
  if (segments.kind) parts.push(propertyKindSlugs[segments.kind][locale]);
  if (segments.citySlug) parts.push(segments.citySlug);
  if (segments.districtSlug) {
    if (!segments.citySlug) {
      throw new Error('A district segment requires its parent city segment.');
    }
    parts.push(segments.districtSlug);
  }
  return `/${parts.join('/')}`;
}

export function withQuery(path: string, query: URLSearchParams | Record<string, string>): string {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export const adminPath = (locale: Locale, subPath = ''): string =>
  `/${locale}/admin${subPath ? `/${subPath.replace(/^\/+/, '')}` : ''}`;

export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}
