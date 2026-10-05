import 'server-only';

import { aliasedTable, and, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { Locale } from '@/i18n/routing';
import type { DealType, PropertyKind } from '@/lib/domain/enums';
import { siteConfig } from '@/config/site';
import { decodeCursor, encodeCursor, type SearchCursor } from '@/features/search/cursor';
import {
  buildKeysetPredicate,
  buildOrderBy,
  buildWhere,
  cursorValueOf,
  publicVisibility,
} from '@/features/search/query-builder';
import type { ResultCount, SearchFacets, SearchFilters } from '@/features/search/types';
import {
  toListingCard,
  toListingDetail,
  type ListingCardRow,
  type ListingDetailRow,
} from '@/features/listings/mappers';
import type { ListingCardDto, ListingDetailDto } from '@/features/listings/dto';
import { db } from '@/server/db/client';
import {
  features,
  listingFeatures,
  listingTranslations,
  listings,
  locations,
  media,
} from '@/server/db/schema';

/**
 * The only module that talks SQL for listings.
 *
 * Keeping every query here means the performance work — index shapes, keyset
 * pagination, the id-first paging trick below — is contained in one file that
 * can be reviewed and benchmarked as a unit.
 */

const cityLocation = aliasedTable(locations, 'city_location');
const districtLocation = aliasedTable(locations, 'district_location');

/** Columns shared by every card query. */
const cardColumns = {
  id: listings.id,
  reference: listings.reference,
  dealType: listings.dealType,
  propertyKind: listings.propertyKind,
  status: listings.status,
  price: listings.price,
  currency: listings.currency,
  priceEur: listings.priceEur,
  pricePerSqmEur: listings.pricePerSqmEur,
  area: listings.area,
  landArea: listings.landArea,
  rooms: listings.rooms,
  bedrooms: listings.bedrooms,
  floor: listings.floor,
  floorsTotal: listings.floorsTotal,
  coverImage: listings.coverImage,
  isFeatured: listings.isFeatured,
  isExclusive: listings.isExclusive,
  publishedAt: listings.publishedAt,
  title: listingTranslations.title,
  slug: listingTranslations.slug,
  sortArea: listings.sortArea,
  sortPricePerSqm: listings.sortPricePerSqm,
  city: {
    nameBg: cityLocation.nameBg,
    nameEn: cityLocation.nameEn,
    slugBg: cityLocation.slugBg,
    slugEn: cityLocation.slugEn,
  },
  district: {
    nameBg: districtLocation.nameBg,
    nameEn: districtLocation.nameEn,
    slugBg: districtLocation.slugBg,
    slugEn: districtLocation.slugEn,
  },
} as const;

type CardQueryRow = ListingCardRow & { sortArea: number; sortPricePerSqm: number };

/**
 * Base card query: listing + its translation for the active locale + the two
 * place names. Every read path that returns cards starts here, so the join
 * shape is defined once.
 */
function cardsFrom(locale: Locale) {
  return db
    .select(cardColumns)
    .from(listings)
    .innerJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
    )
    .leftJoin(cityLocation, eq(cityLocation.id, listings.cityId))
    .leftJoin(districtLocation, eq(districtLocation.id, listings.locationId));
}

export type SearchResultPage = {
  readonly items: readonly ListingCardDto[];
  readonly nextCursor: string | null;
};

/**
 * One page of search results.
 *
 * Filtering and ordering run against `listings` alone in an inner query, so the
 * planner can satisfy them from a composite index and stop after `limit` rows.
 * The joins that fetch titles and place names then run over those few rows
 * rather than over the whole match set — the difference between a page of
 * results costing 3 ms and 300 ms once the catalogue is large.
 */
export async function searchListings(
  locale: Locale,
  filters: SearchFilters,
  options: { cursor?: string; limit?: number } = {},
): Promise<SearchResultPage> {
  const limit = Math.min(options.limit ?? siteConfig.pagination.pageSize, 60);
  const cursor = decodeCursor(options.cursor, filters.sort);

  const where = cursor
    ? and(buildWhere(filters, locale), buildKeysetPredicate(cursor))!
    : buildWhere(filters, locale);

  const page = db
    .select({ id: listings.id })
    .from(listings)
    .where(where)
    .orderBy(...buildOrderBy(filters.sort))
    .limit(limit + 1)
    .as('page');

  const rows = (await db
    .select(cardColumns)
    .from(page)
    .innerJoin(listings, eq(listings.id, page.id))
    .innerJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
    )
    .leftJoin(cityLocation, eq(cityLocation.id, listings.cityId))
    .leftJoin(districtLocation, eq(districtLocation.id, listings.locationId))
    .orderBy(...buildOrderBy(filters.sort))) as CardQueryRow[];

  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);

  const nextCursor: string | null =
    hasMore && last
      ? encodeCursor({
          sort: filters.sort,
          id: last.id,
          value: cursorValueOf(filters.sort, {
            publishedAt: last.publishedAt,
            priceEur: last.priceEur,
            sortArea: last.sortArea,
            sortPricePerSqm: last.sortPricePerSqm,
          }),
        } satisfies SearchCursor)
      : null;

  return {
    items: visible.map((row) => toListingCard(locale, row)),
    nextCursor,
  };
}

/**
 * Result count, capped.
 *
 * An exact `COUNT(*)` over a broad filter has to visit every matching row, so
 * its cost grows with the catalogue — precisely what the performance budget
 * forbids. Counting inside a `LIMIT` bounds the work; beyond the cap the UI says
 * "10 000+", which is what a visitor wants to read anyway.
 */
export async function countListings(locale: Locale, filters: SearchFilters): Promise<ResultCount> {
  const cap = siteConfig.pagination.countCap;

  const capped = db
    .select({ one: sql<number>`1` })
    .from(listings)
    .where(buildWhere(filters, locale))
    .limit(cap)
    .as('capped');

  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(capped);
  const total = row?.total ?? 0;

  return { value: total, capped: total >= cap };
}

/**
 * Facet counts, read from the pre-aggregated materialised view rather than
 * recomputed. The view holds a few thousand rows at most, so summing a slice of
 * it is effectively free and, crucially, constant.
 */
export async function getFacets(
  dealType: DealType,
  scope: { regionId?: string; cityId?: string } = {},
): Promise<SearchFacets> {
  const conditions = [sql`deal_type = ${dealType}`];
  if (scope.regionId) conditions.push(sql`region_id = ${scope.regionId}::uuid`);
  if (scope.cityId) conditions.push(sql`city_id = ${scope.cityId}::uuid`);
  const where = sql.join(conditions, sql` and `);

  const [kinds, cities, districts] = await Promise.all([
    db.execute<{ value: string; count: number }>(sql`
      select property_kind::text as value, sum(listing_count)::int as count
      from listing_facet_counts where ${where}
      group by property_kind order by count desc
    `),
    db.execute<{ value: string; count: number }>(sql`
      select l.slug_bg as value, sum(f.listing_count)::int as count
      from listing_facet_counts f
      join locations l on l.id = f.city_id
      where ${where}
      group by l.slug_bg order by count desc
    `),
    db.execute<{ value: string; count: number }>(sql`
      select l.slug_bg as value, sum(f.listing_count)::int as count
      from listing_facet_counts f
      join locations l on l.id = f.location_id
      where ${where}
      group by l.slug_bg order by count desc limit 40
    `),
  ]);

  const toBuckets = (rows: Iterable<{ value: string; count: number }>) =>
    [...rows].map((row) => ({ value: row.value, count: Number(row.count) }));

  return {
    kinds: toBuckets(kinds),
    cities: toBuckets(cities),
    districts: toBuckets(districts),
  };
}

const detailColumns = {
  ...cardColumns,
  description: listingTranslations.description,
  metaTitle: listingTranslations.metaTitle,
  metaDescription: listingTranslations.metaDescription,
  bathrooms: listings.bathrooms,
  yearBuilt: listings.yearBuilt,
  constructionType: listings.constructionType,
  heating: listings.heating,
  furnishing: listings.furnishing,
  condition: listings.condition,
  energyLabel: listings.energyLabel,
  maintenanceFee: listings.maintenanceFee,
  depositMonths: listings.depositMonths,
  availableFrom: listings.availableFrom,
  videoUrl: listings.videoUrl,
  updatedAt: listings.updatedAt,
  address: listings.address,
  hideExactAddress: listings.hideExactAddress,
  lat: listings.lat,
  lng: listings.lng,
  locationId: listings.locationId,
  cityId: listings.cityId,
} as const;

export type ListingDetailResult = {
  readonly listing: ListingDetailDto;
  /** Internal ids the caller needs for "similar listings" and cache tags. */
  readonly internal: {
    readonly id: string;
    readonly cityId: string | null;
    readonly priceEur: number;
    readonly kind: PropertyKind;
    readonly dealType: DealType;
  };
};

type DetailQueryRow = ListingDetailRow & {
  locationId: string;
  cityId: string | null;
  sortArea: number;
  sortPricePerSqm: number;
};

async function loadListingDetail(
  locale: Locale,
  where: SQL,
): Promise<ListingDetailResult | null> {
  const [row] = (await db
    .select(detailColumns)
    .from(listings)
    .innerJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
    )
    .leftJoin(cityLocation, eq(cityLocation.id, listings.cityId))
    .leftJoin(districtLocation, eq(districtLocation.id, listings.locationId))
    .where(where)
    .limit(1)) as DetailQueryRow[];

  if (!row) return null;

  const [mediaRows, featureRows] = await Promise.all([
    db
      .select({
        id: media.id,
        kind: media.kind,
        width: media.width,
        height: media.height,
        blurDataUrl: media.blurDataUrl,
        altBg: media.altBg,
        altEn: media.altEn,
        variants: media.variants,
      })
      .from(media)
      .where(eq(media.listingId, row.id))
      .orderBy(media.kind, media.sortOrder),
    db
      .select({
        key: features.key,
        category: features.category,
        icon: features.icon,
        nameBg: features.nameBg,
        nameEn: features.nameEn,
      })
      .from(listingFeatures)
      .innerJoin(features, eq(features.id, listingFeatures.featureId))
      .where(eq(listingFeatures.listingId, row.id))
      .orderBy(features.sortOrder),
  ]);

  return {
    listing: toListingDetail(locale, row, mediaRows, featureRows),
    internal: {
      id: row.id,
      cityId: row.cityId,
      priceEur: row.priceEur ?? row.price,
      kind: row.propertyKind,
      dealType: row.dealType,
    },
  };
}

export async function getListingBySlug(
  locale: Locale,
  slug: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<ListingDetailResult | null> {
  const visibility = options.includeUnpublished ? sql`true` : publicVisibility();
  return loadListingDetail(locale, and(eq(listingTranslations.slug, slug), visibility)!);
}

export async function getListingById(
  locale: Locale,
  id: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<ListingDetailResult | null> {
  const visibility = options.includeUnpublished ? sql`true` : publicVisibility();
  return loadListingDetail(locale, and(eq(listings.id, id), visibility)!);
}

/** Same deal type, same kind, same city, comparable price — closest first. */
export async function getSimilarListings(
  locale: Locale,
  reference: ListingDetailResult['internal'],
  limit = 4,
): Promise<readonly ListingCardDto[]> {
  const conditions = [
    publicVisibility(),
    eq(listings.dealType, reference.dealType),
    eq(listings.propertyKind, reference.kind),
    ne(listings.id, reference.id),
  ];
  if (reference.cityId) conditions.push(eq(listings.cityId, reference.cityId));

  const rows = (await cardsFrom(locale)
    .where(and(...conditions))
    .orderBy(sql`abs(${listings.priceEur} - ${reference.priceEur})`)
    .limit(limit)) as CardQueryRow[];

  return rows.map((row) => toListingCard(locale, row));
}

export async function getShowcaseListings(
  locale: Locale,
  options: { featuredOnly?: boolean; dealType?: DealType; limit?: number } = {},
): Promise<readonly ListingCardDto[]> {
  const conditions = [publicVisibility()];
  if (options.featuredOnly) conditions.push(eq(listings.isFeatured, true));
  if (options.dealType) conditions.push(eq(listings.dealType, options.dealType));

  const rows = (await cardsFrom(locale)
    .where(and(...conditions))
    .orderBy(desc(listings.publishedAt), desc(listings.id))
    .limit(options.limit ?? 8)) as CardQueryRow[];

  return rows.map((row) => toListingCard(locale, row));
}

export async function getListingCardsByIds(
  locale: Locale,
  ids: readonly string[],
): Promise<readonly ListingCardDto[]> {
  if (ids.length === 0) return [];

  const rows = (await cardsFrom(locale)
    .where(and(publicVisibility(), inArray(listings.id, [...ids])))
    .limit(ids.length)) as CardQueryRow[];

  // Preserve the caller's ordering, which is the order the visitor saved them in.
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is CardQueryRow => Boolean(row))
    .map((row) => toListingCard(locale, row));
}

/** Slug + timestamp pairs for sitemap generation. */
export async function listPublishedSlugs(
  locale: Locale,
  options: { limit: number; offset: number },
): Promise<readonly { slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: listingTranslations.slug, updatedAt: listings.updatedAt })
    .from(listings)
    .innerJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
    )
    .where(publicVisibility())
    .orderBy(listings.id)
    .limit(options.limit)
    .offset(options.offset);
}

export async function countPublishedListings(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(listings)
    .where(publicVisibility());
  return row?.total ?? 0;
}
