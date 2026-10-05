import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { ListingCard } from '@/features/listings/components/listing-card';
import {
  countListings,
  listFilterableFeatures,
  resolveLocationSegments,
  searchListings,
} from '@/features/listings/queries';
import {
  ActiveFilterChips,
  FilterRail,
  FilterSheet,
} from '@/features/search/components/filter-panel';
import { Pagination, parseCursorStack } from '@/features/search/components/pagination';
import { SortSelect } from '@/features/search/components/sort-select';
import { parseSearchFilters } from '@/features/search/params';
import type { SearchFilters } from '@/features/search/types';
import { buildSearchUrl, scopeDepth, type SearchScope } from '@/features/search/url';
import { isLocale, type Locale } from '@/i18n/routing';
import {
  parseDealSlug,
  parsePropertyKindSlug,
  type DealType,
  type PropertyKind,
} from '@/lib/domain/enums';
import { homePath } from '@/lib/routes';
import { buildAlternates, robotsForSearch } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';

/**
 * Rendered per request, because the result set depends on arbitrary query
 * parameters that cannot be enumerated at build time.
 *
 * That does not make it slow. The expensive part — the database work — is cached
 * by tag in `features/listings/queries`, and the rendered response is cached at
 * the CDN by full URL (see the `Cache-Control` header applied in `proxy.ts`), so
 * a repeated search is served from the edge without touching the origin.
 */
export const dynamic = 'force-dynamic';

type PageParams = { locale: Locale; deal: string; filters?: string[] };
type PageSearchParams = Record<string, string | string[] | undefined>;

type ResolvedRoute = {
  readonly dealType: DealType;
  readonly kind?: PropertyKind;
  readonly city?: { id: string; name: string; slug: string };
  readonly district?: { id: string; name: string; slug: string };
  readonly scope: SearchScope;
  readonly filters: SearchFilters;
};

/**
 * Turns the URL into a validated search.
 *
 * Anything that does not resolve — an unknown deal word, a misspelled
 * neighbourhood, a district that belongs to another city — returns `null` so the
 * route can answer 404. Rendering an unfiltered page for a bad URL would invent
 * an unbounded number of thin, duplicate documents for a crawler to find.
 */
async function resolveRoute(
  locale: Locale,
  params: PageParams,
  searchParams: PageSearchParams,
): Promise<ResolvedRoute | null> {
  if (!isLocale(locale)) return null;

  const dealType = parseDealSlug(locale, params.deal);
  if (!dealType) return null;

  const segments = params.filters ?? [];
  const [first, ...rest] = segments;

  const kind = first ? parsePropertyKindSlug(locale, first) : undefined;
  const locationSegments = kind ? rest : segments;

  const resolved = await resolveLocationSegments(locale, locationSegments);
  if (!resolved) return null;

  const location = resolved.district
    ? ({ id: resolved.district.id, level: 'district' } as const)
    : resolved.city
      ? ({ id: resolved.city.id, level: 'city' } as const)
      : undefined;

  const parsed = parseSearchFilters({ dealType, location, searchParams });
  // A kind in the path is authoritative: it is what makes the URL canonical.
  const filters: SearchFilters = kind ? { ...parsed, kinds: [kind] } : parsed;

  return {
    dealType,
    kind,
    city: resolved.city,
    district: resolved.district,
    scope: {
      deal: dealType,
      citySlug: resolved.city?.slug,
      districtSlug: resolved.district?.slug,
    },
    filters,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const { locale } = resolvedParams;

  const route = await resolveRoute(locale, resolvedParams, resolvedSearch);
  if (!route) return {};

  const t = await getTranslations({ locale, namespace: 'search' });
  const tEnum = await getTranslations({ locale, namespace: 'enums' });

  const subject = route.kind
    ? tEnum(`propertyKindPlural.${route.kind}`)
    : t(route.dealType === 'sale' ? 'titleSale' : 'titleRent');
  const place = route.district?.name ?? route.city?.name;
  const title = place ? `${subject} — ${place}` : subject;

  const hasQueryFilters = Object.keys(resolvedSearch).some(
    (key) => !['sort'].includes(key) && (route.kind ? key !== 'kinds' : true),
  );

  return {
    title,
    description: `${title}. ${siteConfig.name}.`,
    robots: robotsForSearch({
      hasQueryFilters,
      segmentDepth: scopeDepth(route.scope, route.filters),
      isEmpty: false,
    }),
    // Alternates are generated per locale from the same resolved entities, so a
    // Bulgarian filter page always points at its exact English counterpart.
    alternates: buildAlternates(locale, (target) =>
      buildSearchUrl(
        target,
        {
          deal: route.dealType,
          citySlug: route.city ? slugForLocale(route.city.slug, target) : undefined,
          districtSlug: route.district ? slugForLocale(route.district.slug, target) : undefined,
        },
        { ...route.filters, sort: 'newest' },
      ),
    ),
  };
}

/**
 * Location slugs are identical across locales in the seeded taxonomy (place
 * names are transliterated, not translated), so the same slug is reused. An
 * agency that wants genuinely different slugs per language stores both columns
 * already — this is the single place that would need to consult them.
 */
function slugForLocale(slug: string, _locale: Locale): string {
  return slug;
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const { locale } = resolvedParams;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const route = await resolveRoute(locale, resolvedParams, resolvedSearch);
  if (!route) notFound();

  const cursor = typeof resolvedSearch.cursor === 'string' ? resolvedSearch.cursor : undefined;
  const previousCursors = parseCursorStack(
    typeof resolvedSearch.p === 'string' ? resolvedSearch.p : undefined,
  );

  const [t, tEnum, page, count, features] = await Promise.all([
    getTranslations('search'),
    getTranslations('enums'),
    searchListings(locale, route.filters, cursor, siteConfig.pagination.pageSize),
    countListings(locale, route.filters),
    listFilterableFeatures(locale),
  ]);

  const subject = route.kind
    ? tEnum(`propertyKindPlural.${route.kind}`)
    : t(route.dealType === 'sale' ? 'titleSale' : 'titleRent');
  const place = route.district?.name ?? route.city?.name;
  const heading = place ? `${subject} — ${place}` : subject;

  const chipLabels: Record<string, string> = Object.fromEntries([
    ...(['apartment', 'house', 'house_floor', 'land', 'office', 'retail', 'industrial', 'garage', 'hotel', 'agricultural'] as const).map(
      (kind) => [kind, tEnum(`propertyKindPlural.${kind}`)],
    ),
    ...features.map((feature) => [feature.key, feature.name]),
  ]);

  const crumbs = [
    { name: t('breadcrumbHome'), href: homePath(locale) },
    { name: subject, href: buildSearchUrl(locale, { deal: route.dealType }, { ...route.filters, kinds: route.kind ? [route.kind] : [] }) },
    ...(route.city
      ? [
          {
            name: route.city.name,
            href: buildSearchUrl(
              locale,
              { deal: route.dealType, citySlug: route.city.slug },
              route.filters,
            ),
          },
        ]
      : []),
    ...(route.district ? [{ name: route.district.name, href: '' }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />

      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.name}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.href && index < crumbs.length - 1 ? (
                <Link href={crumb.href} className="hover:text-brand">
                  {crumb.name}
                </Link>
              ) : (
                <span className="text-ink-muted">{crumb.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
            {count.capped
              ? t('resultsCountCapped', { count: count.value })
              : t('resultsCount', { count: count.value })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FilterSheet scope={route.scope} filters={route.filters} features={features} />
          <SortSelect scope={route.scope} filters={route.filters} />
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <FilterRail scope={route.scope} filters={route.filters} features={features} />
        </div>

        <div>
          <div className="mb-4">
            <ActiveFilterChips scope={route.scope} filters={route.filters} labels={chipLabels} />
          </div>

          {page.items.length === 0 ? (
            <div className="rounded-card border border-dashed border-line-strong bg-surface p-12 text-center">
              <SearchX className="mx-auto size-10 text-ink-subtle" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-ink">{t('noResultsTitle')}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{t('noResultsText')}</p>
              <Button asChild variant="outline" className="mt-6">
                <Link href={buildSearchUrl(locale, { deal: route.dealType }, emptyFilters(route.dealType))}>
                  {t('title')}
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {page.items.map((listing, index) => (
                <li key={listing.id}>
                  <ListingCard locale={locale} listing={listing} priority={index < 3} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            locale={locale}
            scope={route.scope}
            filters={route.filters}
            cursor={cursor}
            previousCursors={previousCursors}
            nextCursor={page.nextCursor}
            pageNumber={previousCursors.length + 1}
          />
        </div>
      </div>
    </div>
  );
}

function emptyFilters(dealType: DealType): SearchFilters {
  return {
    dealType,
    kinds: [],
    conditions: [],
    constructionTypes: [],
    heating: [],
    furnishing: [],
    featureKeys: [],
    featuredOnly: false,
    sort: 'newest',
  };
}
