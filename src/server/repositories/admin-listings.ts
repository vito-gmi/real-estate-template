import 'server-only';

import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { Locale } from '@/i18n/routing';
import type { ListingStatus } from '@/lib/domain/enums';
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
 * Admin-side data access.
 *
 * Kept separate from the public listing repository because the two have
 * genuinely different rules: this one sees drafts and archived rows, returns
 * exact addresses, and writes. Sharing one module would make it far too easy for
 * a public query to accidentally inherit admin visibility.
 */

export type AdminListingRow = {
  id: string;
  reference: number;
  status: ListingStatus;
  dealType: (typeof listings.$inferSelect)['dealType'];
  propertyKind: (typeof listings.$inferSelect)['propertyKind'];
  price: number | null;
  currency: (typeof listings.$inferSelect)['currency'];
  showPrice: boolean;
  title: string;
  slug: string;
  cityName: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  photoCount: number;
};

export async function listAdminListings(
  locale: Locale,
  options: { statuses?: readonly ListingStatus[]; search?: string; limit?: number; offset?: number },
): Promise<{ rows: readonly AdminListingRow[]; total: number }> {
  const conditions = [];

  if (options.statuses?.length) {
    conditions.push(inArray(listings.status, [...options.statuses]));
  }

  if (options.search) {
    const term = `%${options.search.trim()}%`;
    const digits = options.search.replace(/\D/g, '');
    conditions.push(
      or(
        ilike(listingTranslations.title, term),
        ...(digits ? [sql`${listings.reference}::text like ${`${digits}%`}`] : []),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: listings.id,
        reference: listings.reference,
        status: listings.status,
        dealType: listings.dealType,
        propertyKind: listings.propertyKind,
        price: listings.price,
        currency: listings.currency,
        showPrice: listings.showPrice,
        title: listingTranslations.title,
        slug: listingTranslations.slug,
        cityName: locale === 'bg' ? locations.nameBg : locations.nameEn,
        updatedAt: listings.updatedAt,
        publishedAt: listings.publishedAt,
        photoCount: sql<number>`(select count(*)::int from media m where m.listing_id = ${listings.id})`,
      })
      .from(listings)
      .innerJoin(
        listingTranslations,
        and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
      )
      .leftJoin(locations, eq(locations.id, listings.cityId))
      .where(where)
      .orderBy(desc(listings.updatedAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0),
    db
      .select({ total: count() })
      .from(listings)
      .innerJoin(
        listingTranslations,
        and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
      )
      .where(where),
  ]);

  return { rows: rows as AdminListingRow[], total: Number(totals?.total ?? 0) };
}

export type AdminListingDetail = {
  listing: typeof listings.$inferSelect;
  translations: Record<'bg' | 'en', typeof listingTranslations.$inferSelect | undefined>;
  featureKeys: string[];
  photos: (typeof media.$inferSelect)[];
};

export async function getAdminListing(id: string): Promise<AdminListingDetail | null> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!listing) return null;

  const [translationRows, featureRows, photoRows] = await Promise.all([
    db.select().from(listingTranslations).where(eq(listingTranslations.listingId, id)),
    db
      .select({ key: features.key })
      .from(listingFeatures)
      .innerJoin(features, eq(features.id, listingFeatures.featureId))
      .where(eq(listingFeatures.listingId, id)),
    db.select().from(media).where(eq(media.listingId, id)).orderBy(media.kind, media.sortOrder),
  ]);

  return {
    listing,
    translations: {
      bg: translationRows.find((row) => row.locale === 'bg'),
      en: translationRows.find((row) => row.locale === 'en'),
    },
    featureKeys: featureRows.map((row) => row.key),
    photos: photoRows,
  };
}

export async function countListingsByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: listings.status, total: count() })
    .from(listings)
    .groupBy(listings.status);

  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
}

export async function sumRecentViews(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${listings.viewCount}), 0)::int` })
    .from(listings);
  return Number(row?.total ?? 0);
}

/**
 * Sets the status of many listings at once.
 *
 * `publishedAt` is the "newest first" sort key and the RSS/sitemap date, so it
 * is set only for rows that have never been published and kept for the rest —
 * the same rule as the single-listing status change. Overwriting it would make
 * every bulk-touched listing jump to the top of the site as "new" and lose its
 * real publication date for good. `now` is a JS Date (millisecond precision),
 * not SQL `now()`, because the keyset cursor carries milliseconds.
 */
export async function setListingsStatus(
  ids: readonly string[],
  status: ListingStatus,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(listings)
    .set({
      status,
      publishedAt:
        status === 'draft' ? null : sql`coalesce(${listings.publishedAt}, ${now.toISOString()}::timestamptz)`,
      updatedAt: now,
      updatedBy: actorId,
    })
    .where(inArray(listings.id, [...ids]));
}

/**
 * Re-aggregates the `listing_facet_counts` materialized view (per-city counts
 * on the home page). Postgres never refreshes a materialized view by itself,
 * so every write that can change what is public — status, kind, location,
 * create, delete, import — must call this, or the counts freeze at whatever
 * the last seed left behind.
 *
 * Best-effort: the listing write has already committed, and a stale count is
 * better than reporting a failed save. `CONCURRENTLY` (inside the SQL
 * function) keeps readers unblocked while it runs.
 */
export async function refreshFacetCounts(): Promise<void> {
  try {
    await db.execute(sql`select refresh_listing_facet_counts()`);
  } catch (error) {
    console.error('[facets] refresh failed; home page counts may be stale', error);
  }
}

/** Resolves feature keys to ids so the join table can be rewritten wholesale. */
export async function resolveFeatureIds(keys: readonly string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const rows = await db
    .select({ id: features.id })
    .from(features)
    .where(inArray(features.key, [...keys]));
  return rows.map((row) => row.id);
}

/** Denormalised city and region for the listing's location, for the hot indexes. */
export async function resolveLocationAncestry(
  locationId: string,
): Promise<{ cityId: string | null; regionId: string | null }> {
  const [row] = await db.execute<{ city_id: string | null; region_id: string | null }>(sql`
    with target as (select id, parent_id, level from locations where id = ${locationId}::uuid),
         parent as (select l.id, l.parent_id, l.level from locations l join target t on l.id = t.parent_id),
         grandparent as (select l.id, l.level from locations l join parent p on l.id = p.parent_id)
    select
      case
        when (select level from target) = 'city' then (select id from target)
        when (select level from target) = 'district' then (select id from parent)
      end as city_id,
      case
        when (select level from target) = 'region' then (select id from target)
        when (select level from target) = 'city' then (select id from parent)
        when (select level from target) = 'district' then (select id from grandparent)
      end as region_id
  `);

  return { cityId: row?.city_id ?? null, regionId: row?.region_id ?? null };
}

export type ExportListingRecord = {
  readonly id: string;
  readonly reference: number;
  readonly dealType: (typeof listings.$inferSelect)['dealType'];
  readonly propertyKind: (typeof listings.$inferSelect)['propertyKind'];
  readonly status: (typeof listings.$inferSelect)['status'];
  readonly price: number | null;
  readonly currency: (typeof listings.$inferSelect)['currency'];
  readonly showPrice: boolean;
  readonly area: number | null;
  readonly landArea: number | null;
  readonly rooms: number | null;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly floor: number | null;
  readonly floorsTotal: number | null;
  readonly yearBuilt: number | null;
  readonly constructionType: (typeof listings.$inferSelect)['constructionType'];
  readonly heating: (typeof listings.$inferSelect)['heating'];
  readonly furnishing: (typeof listings.$inferSelect)['furnishing'];
  readonly condition: (typeof listings.$inferSelect)['condition'];
  readonly energyLabel: string | null;
  readonly maintenanceFee: number | null;
  readonly depositMonths: number | null;
  readonly availableFrom: string | null;
  readonly locationId: string;
  readonly address: string | null;
  readonly hideExactAddress: boolean;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly videoUrl: string | null;
  readonly isFeatured: boolean;
  readonly isExclusive: boolean;
  readonly titleBg: string;
  readonly titleEn: string;
  readonly descriptionBg: string;
  readonly descriptionEn: string;
  readonly slugBg: string;
  readonly slugEn: string;
  readonly featureKeys: string[];
};

/** Full catalog dump for CSV/JSON export. Not paginated — this is an admin operation. */
export async function listListingsForExport(): Promise<readonly ExportListingRecord[]> {
  const rows = await db.select().from(listings).orderBy(desc(listings.reference));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [translationRows, featureRows] = await Promise.all([
    db.select().from(listingTranslations).where(inArray(listingTranslations.listingId, ids)),
    db
      .select({ listingId: listingFeatures.listingId, key: features.key })
      .from(listingFeatures)
      .innerJoin(features, eq(features.id, listingFeatures.featureId))
      .where(inArray(listingFeatures.listingId, ids)),
  ]);

  const translationsByListing = new Map<string, typeof translationRows>();
  for (const row of translationRows) {
    const current = translationsByListing.get(row.listingId) ?? [];
    current.push(row);
    translationsByListing.set(row.listingId, current);
  }

  const featuresByListing = new Map<string, string[]>();
  for (const row of featureRows) {
    const current = featuresByListing.get(row.listingId) ?? [];
    current.push(row.key);
    featuresByListing.set(row.listingId, current);
  }

  return rows.map((row) => {
    const translations = translationsByListing.get(row.id) ?? [];
    const bg = translations.find((item) => item.locale === 'bg');
    const en = translations.find((item) => item.locale === 'en');
    return {
      id: row.id,
      reference: row.reference,
      dealType: row.dealType,
      propertyKind: row.propertyKind,
      status: row.status,
      price: row.price,
      currency: row.currency,
      showPrice: row.showPrice,
      area: row.area,
      landArea: row.landArea,
      rooms: row.rooms,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      floor: row.floor,
      floorsTotal: row.floorsTotal,
      yearBuilt: row.yearBuilt,
      constructionType: row.constructionType,
      heating: row.heating,
      furnishing: row.furnishing,
      condition: row.condition,
      energyLabel: row.energyLabel,
      maintenanceFee: row.maintenanceFee,
      depositMonths: row.depositMonths,
      availableFrom: row.availableFrom,
      locationId: row.locationId,
      address: row.address,
      hideExactAddress: row.hideExactAddress,
      lat: row.lat,
      lng: row.lng,
      videoUrl: row.videoUrl,
      isFeatured: row.isFeatured,
      isExclusive: row.isExclusive,
      titleBg: bg?.title ?? '',
      titleEn: en?.title ?? '',
      descriptionBg: bg?.description ?? '',
      descriptionEn: en?.description ?? '',
      slugBg: bg?.slug ?? '',
      slugEn: en?.slug ?? '',
      featureKeys: featuresByListing.get(row.id) ?? [],
    };
  });
}
