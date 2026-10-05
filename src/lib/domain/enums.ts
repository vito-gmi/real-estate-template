import type { Locale } from "@/i18n/routing";

/**
 * The shared vocabulary of the domain.
 *
 * These arrays are the single source of truth: Drizzle builds its Postgres enums
 * from them, Zod builds its validators from them, and the UI builds its filter
 * options from them. Adding a property kind is a one-line change here plus a
 * translation string — nothing else in the codebase enumerates these values.
 */

export const dealTypes = ["sale", "rent"] as const;
export type DealType = (typeof dealTypes)[number];

export const propertyKinds = [
  "apartment",
  "house",
  "house_floor",
  "land",
  "office",
  "retail",
  "industrial",
  "garage",
  "hotel",
  "agricultural",
] as const;
export type PropertyKind = (typeof propertyKinds)[number];

export const listingStatuses = [
  "draft",
  "active",
  "reserved",
  "sold",
  "rented",
  "archived",
] as const;
export type ListingStatus = (typeof listingStatuses)[number];

/** Statuses a visitor is allowed to see. Everything else is admin-only. */
export const publicListingStatuses = [
  "active",
  "reserved",
] as const satisfies readonly ListingStatus[];

export const constructionTypes = [
  "brick",
  "epk",
  "pk",
  "panel",
  "wood_floor",
  "steel",
  "other",
] as const;
export type ConstructionType = (typeof constructionTypes)[number];

export const heatingTypes = [
  "central",
  "gas",
  "electric",
  "air_conditioning",
  "pellet",
  "wood",
  "underfloor",
  "none",
] as const;
export type HeatingType = (typeof heatingTypes)[number];

export const furnishingTypes = [
  "furnished",
  "partially_furnished",
  "unfurnished",
] as const;
export type FurnishingType = (typeof furnishingTypes)[number];

/** Mirrors how Bulgarian listings describe build stage and condition. */
export const conditions = [
  "off_plan",
  "shell",
  "act14",
  "act15",
  "act16",
  "new",
  "renovated",
  "good",
  "needs_renovation",
] as const;
export type Condition = (typeof conditions)[number];

export const currencies = ["EUR", "BGN"] as const;
export type Currency = (typeof currencies)[number];

export const mediaKinds = ["photo", "floor_plan", "document"] as const;
export type MediaKind = (typeof mediaKinds)[number];

export const inquiryStatuses = [
  "new",
  "in_progress",
  "closed",
  "spam",
] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];

export const inquiryKinds = ["message", "callback", "viewing"] as const;
export type InquiryKind = (typeof inquiryKinds)[number];

export const userRoles = ["admin", "editor", "agent"] as const;
export type UserRole = (typeof userRoles)[number];

export const locationLevels = [
  "country",
  "region",
  "city",
  "district",
] as const;
export type LocationLevel = (typeof locationLevels)[number];

export const sortOptions = [
  "newest",
  "price_asc",
  "price_desc",
  "area_desc",
  "price_per_sqm_asc",
] as const;
export type SortOption = (typeof sortOptions)[number];
export const defaultSort: SortOption = "newest";

/** Only these kinds have an indoor area worth showing a price-per-m² for. */
export const kindsWithoutIndoorArea = [
  "land",
  "agricultural",
] as const satisfies readonly PropertyKind[];

export function hasIndoorArea(kind: PropertyKind): boolean {
  return !(kindsWithoutIndoorArea as readonly PropertyKind[]).includes(kind);
}

type SlugMap<T extends string> = Readonly<
  Record<T, Readonly<Record<Locale, string>>>
>;

export const dealTypeSlugs: SlugMap<DealType> = {
  sale: { bg: "prodazhba", en: "for-sale" },
  rent: { bg: "naem", en: "for-rent" },
};

export const propertyKindSlugs: SlugMap<PropertyKind> = {
  apartment: { bg: "apartamenti", en: "apartments" },
  house: { bg: "kashti", en: "houses" },
  house_floor: { bg: "etaji-ot-kashta", en: "house-floors" },
  land: { bg: "parceli", en: "land-plots" },
  office: { bg: "ofisi", en: "offices" },
  retail: { bg: "magazini", en: "shops" },
  industrial: { bg: "industrialni-imoti", en: "industrial" },
  garage: { bg: "garaji", en: "garages" },
  hotel: { bg: "hoteli", en: "hotels" },
  agricultural: { bg: "zemedelski-zemi", en: "agricultural-land" },
};

function invert<T extends string>(map: SlugMap<T>, values: readonly T[]) {
  const byLocale = {} as Record<Locale, Map<string, T>>;
  for (const locale of ["bg", "en"] as const) {
    const entries = new Map<string, T>();
    for (const value of values) entries.set(map[value][locale], value);
    byLocale[locale] = entries;
  }
  return byLocale;
}

const dealTypeBySlug = invert(dealTypeSlugs, dealTypes);
const propertyKindBySlug = invert(propertyKindSlugs, propertyKinds);

export function parseDealSlug(
  locale: Locale,
  slug: string,
): DealType | undefined {
  // `locale` is typed as `bg | en`, but this helper is also reached by stray
  // requests that Next matches as `[locale]/[deal]` (Chrome DevTools'
  // `/.well-known/...` is the usual one). Missing map → not a deal URL.
  return dealTypeBySlug[locale]?.get(slug);
}

export function parsePropertyKindSlug(
  locale: Locale,
  slug: string,
): PropertyKind | undefined {
  return propertyKindBySlug[locale]?.get(slug);
}
