import 'server-only';

import { and, asc, eq, sql } from 'drizzle-orm';
import type { Locale } from '@/i18n/routing';
import { db } from '@/server/db/client';
import { locations } from '@/server/db/schema';

export type LocationNode = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly level: 'region' | 'city' | 'district';
  readonly parentId: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
};

function nameColumn(locale: Locale) {
  return locale === 'bg' ? locations.nameBg : locations.nameEn;
}

function slugColumn(locale: Locale) {
  return locale === 'bg' ? locations.slugBg : locations.slugEn;
}

/** Cities with their districts, used to build the location filter. */
export async function getLocationTree(locale: Locale): Promise<readonly LocationNode[]> {
  const rows = await db
    .select({
      id: locations.id,
      name: nameColumn(locale),
      slug: slugColumn(locale),
      level: locations.level,
      parentId: locations.parentId,
      lat: locations.lat,
      lng: locations.lng,
    })
    .from(locations)
    .where(and(eq(locations.isActive, true), sql`${locations.level} in ('region','city','district')`))
    .orderBy(asc(locations.level), asc(locations.sortOrder), asc(nameColumn(locale)));

  return rows as LocationNode[];
}

export type ResolvedLocation = {
  readonly city?: LocationNode;
  readonly district?: LocationNode;
};

/**
 * Turns URL path segments into location ids.
 *
 * Returns `null` for anything unrecognised so the route can answer 404 rather
 * than silently rendering an unfiltered page — inventing results for a bad URL
 * is how duplicate content and crawl-budget waste start.
 */
export async function resolveLocationSegments(
  locale: Locale,
  segments: readonly string[],
): Promise<ResolvedLocation | null> {
  if (segments.length === 0) return {};
  if (segments.length > 2) return null;

  const [citySlug, districtSlug] = segments;

  const [city] = (await db
    .select({
      id: locations.id,
      name: nameColumn(locale),
      slug: slugColumn(locale),
      level: locations.level,
      parentId: locations.parentId,
      lat: locations.lat,
      lng: locations.lng,
    })
    .from(locations)
    .where(and(eq(locations.level, 'city'), eq(slugColumn(locale), citySlug!)))
    .limit(1)) as LocationNode[];

  if (!city) return null;
  if (!districtSlug) return { city };

  const [district] = (await db
    .select({
      id: locations.id,
      name: nameColumn(locale),
      slug: slugColumn(locale),
      level: locations.level,
      parentId: locations.parentId,
      lat: locations.lat,
      lng: locations.lng,
    })
    .from(locations)
    .where(
      and(
        eq(locations.level, 'district'),
        eq(locations.parentId, city.id),
        eq(slugColumn(locale), districtSlug),
      ),
    )
    .limit(1)) as LocationNode[];

  if (!district) return null;
  return { city, district };
}

/** Cities ordered by how much inventory they hold, for the home page links. */
export async function getPopularCities(
  locale: Locale,
  limit = 8,
): Promise<readonly (LocationNode & { listingCount: number })[]> {
  const rows = await db.execute<{
    id: string;
    name: string;
    slug: string;
    listing_count: number;
  }>(sql`
    select l.id,
           ${locale === 'bg' ? sql`l.name_bg` : sql`l.name_en`} as name,
           ${locale === 'bg' ? sql`l.slug_bg` : sql`l.slug_en`} as slug,
           coalesce(sum(f.listing_count), 0)::int as listing_count
    from locations l
    left join listing_facet_counts f on f.city_id = l.id
    where l.level = 'city' and l.is_active
    group by l.id, name, slug
    order by listing_count desc, name asc
    limit ${limit}
  `);

  return [...rows].map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    level: 'city' as const,
    parentId: null,
    lat: null,
    lng: null,
    listingCount: Number(row.listing_count),
  }));
}
