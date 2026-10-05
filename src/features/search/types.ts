import type {
  Condition,
  ConstructionType,
  DealType,
  FurnishingType,
  HeatingType,
  PropertyKind,
  SortOption,
} from '@/lib/domain/enums';

/**
 * The complete, validated description of a search.
 *
 * Everything downstream — SQL, cache keys, canonical URLs, RSS feeds — is
 * derived from this one object, so there is exactly one definition of what a
 * search is.
 */
export type SearchFilters = {
  readonly dealType: DealType;
  readonly kinds: readonly PropertyKind[];
  /**
   * The level matters: a district matches `locationId`, a city matches the
   * denormalised `cityId`, a region matches `regionId`. Carrying the level here
   * means the query never has to walk the location hierarchy.
   */
  readonly location?: { readonly id: string; readonly level: 'region' | 'city' | 'district' };
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly areaMin?: number;
  readonly areaMax?: number;
  readonly roomsMin?: number;
  readonly roomsMax?: number;
  readonly bedroomsMin?: number;
  readonly floorMin?: number;
  readonly floorMax?: number;
  readonly yearBuiltMin?: number;
  readonly conditions: readonly Condition[];
  readonly constructionTypes: readonly ConstructionType[];
  readonly heating: readonly HeatingType[];
  readonly furnishing: readonly FurnishingType[];
  readonly featureKeys: readonly string[];
  readonly keyword?: string;
  readonly featuredOnly: boolean;
  readonly sort: SortOption;
};

export type SearchPage = {
  readonly cursor?: string;
  readonly limit: number;
};

/** Result counts stop being exact past the configured cap to keep latency flat. */
export type ResultCount = {
  readonly value: number;
  readonly capped: boolean;
};

export type FacetBucket = {
  readonly value: string;
  readonly count: number;
};

export type SearchFacets = {
  readonly kinds: readonly FacetBucket[];
  readonly cities: readonly FacetBucket[];
  readonly districts: readonly FacetBucket[];
};
