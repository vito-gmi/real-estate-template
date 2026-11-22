import { and, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { publicListingStatuses, type SortOption } from '@/lib/domain/enums';
import { listingTranslations, listings } from '@/server/db/schema';
import type { SearchCursor } from './cursor';
import type { SearchFilters } from './types';

/**
 * Composes a listing search into SQL.
 *
 * Each filter is an independent, self-contained rule in `filterRules`. Adding
 * "minimum bathrooms" is one entry in that array — not another branch in a
 * growing `if` pyramid — and every rule can be reasoned about on its own.
 *
 * All rules target columns on `listings` alone. That is the whole performance
 * strategy: the query touches one table, and the composite indexes on it can
 * satisfy any combination of these predicates without a join or a sort.
 */

type FilterRule = {
  readonly key: keyof SearchFilters | 'location' | 'price';
  readonly apply: (filters: SearchFilters, locale: 'bg' | 'en') => SQL | undefined;
};

const filterRules: readonly FilterRule[] = [
  {
    key: 'dealType',
    apply: (filters) => eq(listings.dealType, filters.dealType),
  },
  {
    key: 'kinds',
    apply: (filters) =>
      filters.kinds.length > 0 ? inArray(listings.propertyKind, [...filters.kinds]) : undefined,
  },
  {
    key: 'location',
    apply: (filters) => {
      if (!filters.location) return undefined;
      const { id, level } = filters.location;
      if (level === 'district') return eq(listings.locationId, id);
      if (level === 'city') return eq(listings.cityId, id);
      return eq(listings.regionId, id);
    },
  },
  {
    key: 'price',
    apply: (filters) => {
      if (!filters.priceMin && !filters.priceMax) return undefined;
      // `price_eur` is null when the price is hidden, so those listings fall out
      // of the range on their own. Featured and exclusive ones are kept: the
      // agency wants them seen in every search. They are kept regardless of the
      // stored amount, so the result set says nothing about a hidden price.
      const inRange = and(
        filters.priceMin ? gte(listings.priceEur, filters.priceMin) : undefined,
        filters.priceMax ? lte(listings.priceEur, filters.priceMax) : undefined,
      )!;
      const promotedWithoutPrice = and(
        sql`${listings.priceEur} is null`,
        or(eq(listings.isFeatured, true), eq(listings.isExclusive, true)),
      )!;
      return or(inRange, promotedWithoutPrice);
    },
  },
  {
    key: 'areaMin',
    apply: (filters) => (filters.areaMin ? gte(listings.sortArea, filters.areaMin) : undefined),
  },
  {
    key: 'areaMax',
    apply: (filters) => (filters.areaMax ? lte(listings.sortArea, filters.areaMax) : undefined),
  },
  {
    key: 'roomsMin',
    apply: (filters) => (filters.roomsMin ? gte(listings.rooms, filters.roomsMin) : undefined),
  },
  {
    key: 'roomsMax',
    apply: (filters) => (filters.roomsMax ? lte(listings.rooms, filters.roomsMax) : undefined),
  },
  {
    key: 'bedroomsMin',
    apply: (filters) =>
      filters.bedroomsMin ? gte(listings.bedrooms, filters.bedroomsMin) : undefined,
  },
  {
    key: 'floorMin',
    apply: (filters) => (filters.floorMin ? gte(listings.floor, filters.floorMin) : undefined),
  },
  {
    key: 'floorMax',
    apply: (filters) => (filters.floorMax ? lte(listings.floor, filters.floorMax) : undefined),
  },
  {
    key: 'yearBuiltMin',
    apply: (filters) =>
      filters.yearBuiltMin ? gte(listings.yearBuilt, filters.yearBuiltMin) : undefined,
  },
  {
    key: 'conditions',
    apply: (filters) =>
      filters.conditions.length > 0 ? inArray(listings.condition, [...filters.conditions]) : undefined,
  },
  {
    key: 'constructionTypes',
    apply: (filters) =>
      filters.constructionTypes.length > 0
        ? inArray(listings.constructionType, [...filters.constructionTypes])
        : undefined,
  },
  {
    key: 'heating',
    apply: (filters) =>
      filters.heating.length > 0 ? inArray(listings.heating, [...filters.heating]) : undefined,
  },
  {
    key: 'furnishing',
    apply: (filters) =>
      filters.furnishing.length > 0 ? inArray(listings.furnishing, [...filters.furnishing]) : undefined,
  },
  {
    key: 'featuredOnly',
    apply: (filters) => (filters.featuredOnly ? eq(listings.isFeatured, true) : undefined),
  },
  {
    key: 'featureKeys',
    apply: (filters) => {
      if (filters.featureKeys.length === 0) return undefined;
      // "All of these features", not "any of them": group the join and require
      // the match count to equal the number of requested keys.
      return sql`${listings.id} in (
        select lf.listing_id
        from listing_features lf
        join features f on f.id = lf.feature_id
        where f.key in ${sql.raw(`(${filters.featureKeys.map((key) => `'${escapeLiteral(key)}'`).join(',')})`)}
        group by lf.listing_id
        having count(distinct f.key) = ${filters.featureKeys.length}
      )`;
    },
  },
  {
    key: 'keyword',
    apply: (filters, locale) => {
      const keyword = filters.keyword?.trim();
      if (!keyword) return undefined;

      // Agents paste reference numbers straight into the search box.
      const digits = keyword.replace(/\D/g, '');
      const referenceMatch =
        digits.length >= 4 ? sql`${listings.reference}::text like ${`${digits}%`}` : undefined;

      const fullText = sql`exists (
        select 1 from ${listingTranslations} lt
        where lt.listing_id = ${listings.id}
          and lt.locale = ${locale}
          and lt.search_vector @@ plainto_tsquery('simple', ${keyword})
      )`;

      return referenceMatch ? sql`(${fullText} or ${referenceMatch})` : fullText;
    },
  },
];

/** Feature keys come from a fixed taxonomy, but quoting is cheap insurance. */
function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''").replace(/[^\w'-]/g, '');
}

/** Visitors only ever see published listings. */
export function publicVisibility(): SQL {
  return and(
    inArray(listings.status, [...publicListingStatuses]),
    sql`${listings.publishedAt} is not null`,
  )!;
}

export function buildFilterConditions(filters: SearchFilters, locale: 'bg' | 'en'): SQL[] {
  return filterRules
    .map((rule) => rule.apply(filters, locale))
    .filter((condition): condition is SQL => condition !== undefined);
}

export function buildWhere(filters: SearchFilters, locale: 'bg' | 'en'): SQL {
  return and(publicVisibility(), ...buildFilterConditions(filters, locale))!;
}

// ---------------------------------------------------------------------------
// Sorting and keyset pagination
// ---------------------------------------------------------------------------

type SortDefinition = {
  readonly column: PgColumn;
  readonly direction: 'asc' | 'desc';
  /** Converts a row's sort key into the opaque string carried by the cursor. */
  readonly toCursorValue: (row: SortRowValues) => string;
  /** Turns that string back into a bound parameter of the right SQL type. */
  readonly toSqlValue: (raw: string) => SQL;
};

export type SortRowValues = {
  readonly publishedAt: Date | null;
  readonly sortPriceAsc: number;
  readonly sortPriceDesc: number;
  readonly sortArea: number;
  readonly sortPricePerSqm: number;
};

const numeric = (raw: string): SQL => sql`${Number(raw)}::numeric`;
const timestamp = (raw: string): SQL => sql`${new Date(Number(raw)).toISOString()}::timestamptz`;

const sortDefinitions: Readonly<Record<SortOption, SortDefinition>> = {
  newest: {
    column: listings.publishedAt,
    direction: 'desc',
    toCursorValue: (row) => String(row.publishedAt?.getTime() ?? 0),
    toSqlValue: timestamp,
  },
  price_asc: {
    column: listings.sortPriceAsc,
    direction: 'asc',
    toCursorValue: (row) => String(row.sortPriceAsc),
    toSqlValue: numeric,
  },
  price_desc: {
    column: listings.sortPriceDesc,
    direction: 'desc',
    toCursorValue: (row) => String(row.sortPriceDesc),
    toSqlValue: numeric,
  },
  area_desc: {
    column: listings.sortArea,
    direction: 'desc',
    toCursorValue: (row) => String(row.sortArea),
    toSqlValue: numeric,
  },
  price_per_sqm_asc: {
    column: listings.sortPricePerSqm,
    direction: 'asc',
    toCursorValue: (row) => String(row.sortPricePerSqm),
    toSqlValue: numeric,
  },
};

export function buildOrderBy(sort: SortOption): SQL[] {
  const definition = sortDefinitions[sort];
  return definition.direction === 'desc'
    ? [sql`${definition.column} desc`, sql`${listings.id} desc`]
    : [sql`${definition.column} asc`, sql`${listings.id} asc`];
}

/**
 * Row-value comparison — `(sort_key, id) < (:value, :id)` — rather than the
 * usual `a < x OR (a = x AND b < y)`. Postgres can drive a composite index
 * straight from the tuple form, and it reads the way the intent does.
 *
 * Every sort key is non-null by construction (see the generated columns on the
 * listings table), so no null-handling branch is needed here.
 */
export function buildKeysetPredicate(cursor: SearchCursor): SQL {
  const definition = sortDefinitions[cursor.sort];
  const value = definition.toSqlValue(cursor.value);
  const id = sql`${cursor.id}::uuid`;

  return definition.direction === 'desc'
    ? sql`(${definition.column}, ${listings.id}) < (${value}, ${id})`
    : sql`(${definition.column}, ${listings.id}) > (${value}, ${id})`;
}

export function cursorValueOf(sort: SortOption, row: SortRowValues): string {
  return sortDefinitions[sort].toCursorValue(row);
}
