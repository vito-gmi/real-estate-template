import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { localeTags, locales, type Locale } from '@/i18n/routing';

/**
 * Canonical and hreflang construction.
 *
 * Every indexable page must declare one canonical URL and the full set of
 * language alternates; getting this wrong on a bilingual site is the fastest
 * way to have Google treat the two languages as duplicates of each other.
 *
 * The alternates are also what the visible language switcher reads at runtime,
 * so there is exactly one place that knows how a page maps across locales.
 */
export function buildAlternates(
  activeLocale: Locale,
  pathFor: (locale: Locale) => string | null,
): Metadata['alternates'] {
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    const path = pathFor(locale);
    if (path) languages[localeTags[locale]] = absolute(localised(locale, path));
  }

  const canonicalPath = pathFor(activeLocale);

  return {
    canonical: canonicalPath ? absolute(localised(activeLocale, canonicalPath)) : undefined,
    languages: {
      ...languages,
      'x-default': absolute(`/${locales[0]}`),
    },
  };
}

function localised(locale: Locale, path: string): string {
  if (path === '/') return `/${locale}`;
  return path.startsWith(`/${locale}/`) || path === `/${locale}` ? path : `/${locale}${path}`;
}

export function absolute(path: string): string {
  return new URL(path, siteConfig.url).toString();
}

/**
 * Search-result pages beyond a shallow, curated set are marked `noindex`.
 *
 * Filter combinations multiply exponentially; letting a crawler discover all of
 * them wastes the crawl budget that should be spent on listing pages, and
 * produces thousands of near-identical documents.
 */
export function robotsForSearch(options: {
  readonly hasQueryFilters: boolean;
  readonly segmentDepth: number;
  readonly isEmpty: boolean;
}): Metadata['robots'] {
  const indexable =
    !options.hasQueryFilters &&
    !options.isEmpty &&
    options.segmentDepth <= siteConfig.seo.indexableFilterDepth;

  return indexable
    ? { index: true, follow: true }
    : { index: false, follow: true, googleBot: { index: false, follow: true } };
}

export function truncateForMeta(text: string, max = 155): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, collapsed.lastIndexOf(' ', max - 1))}…`;
}
