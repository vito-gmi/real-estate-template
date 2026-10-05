import { z } from 'zod';
import {
  conditions,
  constructionTypes,
  defaultSort,
  furnishingTypes,
  heatingTypes,
  propertyKinds,
  sortOptions,
  type DealType,
} from '@/lib/domain/enums';
import type { SearchFilters } from './types';

/**
 * Query-string codec.
 *
 * Parsing and serialising live side by side so a round-trip is guaranteed to be
 * lossless — which is what makes canonical URLs, "clear this filter" links and
 * cache keys agree with one another. Unknown or malformed parameters are dropped
 * rather than rejected: a visitor should never see an error page because a link
 * was truncated in a chat app.
 */

const csv = (values: readonly [string, ...string[]]) =>
  z
    .string()
    .optional()
    .transform((raw) => (raw ? raw.split(',').map((part) => part.trim()) : []))
    .pipe(z.array(z.enum(values)))
    .catch([]);

const positiveInt = z.coerce.number().int().positive().optional().catch(undefined);
const positiveNumber = z.coerce.number().positive().optional().catch(undefined);

const schema = z.object({
  kinds: csv(propertyKinds as unknown as [string, ...string[]]),
  conditions: csv(conditions as unknown as [string, ...string[]]),
  construction: csv(constructionTypes as unknown as [string, ...string[]]),
  heating: csv(heatingTypes as unknown as [string, ...string[]]),
  furnishing: csv(furnishingTypes as unknown as [string, ...string[]]),
  features: z
    .string()
    .optional()
    .transform((raw) => (raw ? raw.split(',').map((part) => part.trim()).filter(Boolean) : []))
    .catch([]),
  priceMin: positiveNumber,
  priceMax: positiveNumber,
  areaMin: positiveNumber,
  areaMax: positiveNumber,
  roomsMin: positiveInt,
  roomsMax: positiveInt,
  bedroomsMin: positiveInt,
  floorMin: positiveInt,
  floorMax: positiveInt,
  yearBuiltMin: positiveInt,
  q: z.string().trim().min(2).max(120).optional().catch(undefined),
  featured: z
    .string()
    .optional()
    .transform((raw) => raw === '1' || raw === 'true')
    .catch(false),
  sort: z.enum(sortOptions).catch(defaultSort),
});

export type SearchQueryInput = {
  readonly dealType: DealType;
  readonly location?: SearchFilters['location'];
  readonly searchParams: Record<string, string | string[] | undefined>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSearchFilters({
  dealType,
  location,
  searchParams,
}: SearchQueryInput): SearchFilters {
  const flat = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, firstValue(value)]),
  );

  const parsed = schema.parse(flat);

  // Swapped bounds are a common copy-paste mistake in shared links; silently
  // normalising them is kinder than showing zero results.
  const [priceMin, priceMax] = orderPair(parsed.priceMin, parsed.priceMax);
  const [areaMin, areaMax] = orderPair(parsed.areaMin, parsed.areaMax);
  const [roomsMin, roomsMax] = orderPair(parsed.roomsMin, parsed.roomsMax);
  const [floorMin, floorMax] = orderPair(parsed.floorMin, parsed.floorMax);

  return {
    dealType,
    location,
    kinds: parsed.kinds as SearchFilters['kinds'],
    conditions: parsed.conditions as SearchFilters['conditions'],
    constructionTypes: parsed.construction as SearchFilters['constructionTypes'],
    heating: parsed.heating as SearchFilters['heating'],
    furnishing: parsed.furnishing as SearchFilters['furnishing'],
    featureKeys: parsed.features,
    priceMin,
    priceMax,
    areaMin,
    areaMax,
    roomsMin,
    roomsMax,
    bedroomsMin: parsed.bedroomsMin,
    floorMin,
    floorMax,
    yearBuiltMin: parsed.yearBuiltMin,
    keyword: parsed.q,
    featuredOnly: parsed.featured,
    sort: parsed.sort,
  };
}

function orderPair(
  min: number | undefined,
  max: number | undefined,
): [number | undefined, number | undefined] {
  if (min !== undefined && max !== undefined && min > max) return [max, min];
  return [min, max];
}

/**
 * Serialises filters back to a query string. Keys are emitted in a fixed order
 * and defaults are omitted, so the same search always produces the same URL —
 * a prerequisite for both canonical tags and cache hits.
 */
export function serializeSearchFilters(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  const setList = (key: string, values: readonly string[]) => {
    if (values.length > 0) params.set(key, [...values].sort().join(','));
  };
  const setNumber = (key: string, value: number | undefined) => {
    if (value !== undefined) params.set(key, String(value));
  };

  setList('kinds', filters.kinds);
  setNumber('priceMin', filters.priceMin);
  setNumber('priceMax', filters.priceMax);
  setNumber('areaMin', filters.areaMin);
  setNumber('areaMax', filters.areaMax);
  setNumber('roomsMin', filters.roomsMin);
  setNumber('roomsMax', filters.roomsMax);
  setNumber('bedroomsMin', filters.bedroomsMin);
  setNumber('floorMin', filters.floorMin);
  setNumber('floorMax', filters.floorMax);
  setNumber('yearBuiltMin', filters.yearBuiltMin);
  setList('conditions', filters.conditions);
  setList('construction', filters.constructionTypes);
  setList('heating', filters.heating);
  setList('furnishing', filters.furnishing);
  setList('features', filters.featureKeys);
  if (filters.keyword) params.set('q', filters.keyword);
  if (filters.featuredOnly) params.set('featured', '1');
  if (filters.sort !== defaultSort) params.set('sort', filters.sort);

  return params;
}

/** True when nothing beyond the path segments narrows the result set. */
export function isPristine(filters: SearchFilters): boolean {
  return serializeSearchFilters(filters).toString() === '';
}

/** Number of active refinements, for the "Filters (3)" badge. */
export function countActiveFilters(filters: SearchFilters): number {
  const params = serializeSearchFilters(filters);
  params.delete('sort');
  return [...params.keys()].length;
}
