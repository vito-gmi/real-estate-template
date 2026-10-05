import 'server-only';

import { and, asc, count, eq, sql } from 'drizzle-orm';
import { slugify } from '@/lib/utils';
import { db } from '@/server/db/client';
import { features, listings, locations } from '@/server/db/schema';
import type { LocationLevel } from '@/lib/domain/enums';

/**
 * Admin taxonomy writes.
 *
 * Locations and features are edited rarely and read on every public page, so
 * every mutation here is expected to be followed by `revalidateTaxonomyCaches`.
 */

export async function listLocationsAdmin() {
  return db
    .select()
    .from(locations)
    .orderBy(asc(locations.level), asc(locations.sortOrder), asc(locations.nameEn));
}

export async function createLocation(values: {
  parentId: string | null;
  level: LocationLevel;
  nameBg: string;
  nameEn: string;
  slugBg?: string;
  slugEn?: string;
  lat?: number | null;
  lng?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const [row] = await db
    .insert(locations)
    .values({
      parentId: values.parentId,
      level: values.level,
      nameBg: values.nameBg,
      nameEn: values.nameEn,
      slugBg: values.slugBg ? slugify(values.slugBg) : slugify(values.nameBg),
      slugEn: values.slugEn ? slugify(values.slugEn) : slugify(values.nameEn),
      lat: values.lat ?? null,
      lng: values.lng ?? null,
      sortOrder: values.sortOrder ?? 0,
      isActive: values.isActive ?? true,
    })
    .returning({ id: locations.id });
  return row!.id;
}

export async function updateLocation(
  id: string,
  values: {
    parentId?: string | null;
    nameBg: string;
    nameEn: string;
    slugBg?: string;
    slugEn?: string;
    lat?: number | null;
    lng?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  await db
    .update(locations)
    .set({
      parentId: values.parentId,
      nameBg: values.nameBg,
      nameEn: values.nameEn,
      slugBg: values.slugBg ? slugify(values.slugBg) : slugify(values.nameBg),
      slugEn: values.slugEn ? slugify(values.slugEn) : slugify(values.nameEn),
      lat: values.lat ?? null,
      lng: values.lng ?? null,
      sortOrder: values.sortOrder ?? 0,
      isActive: values.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(locations.id, id));
}

export async function deleteLocation(id: string): Promise<'ok' | 'in_use'> {
  const [children] = await db
    .select({ total: count() })
    .from(locations)
    .where(eq(locations.parentId, id));
  const [used] = await db
    .select({ total: count() })
    .from(listings)
    .where(
      sql`${listings.locationId} = ${id}::uuid or ${listings.cityId} = ${id}::uuid or ${listings.regionId} = ${id}::uuid`,
    );

  if (Number(children?.total ?? 0) > 0 || Number(used?.total ?? 0) > 0) return 'in_use';

  await db.delete(locations).where(eq(locations.id, id));
  return 'ok';
}

export async function listFeaturesAdmin() {
  return db
    .select()
    .from(features)
    .orderBy(asc(features.category), asc(features.sortOrder), asc(features.nameEn));
}

export async function createFeature(values: {
  key: string;
  category: string;
  nameBg: string;
  nameEn: string;
  icon?: string | null;
  sortOrder?: number;
  isFilterable?: boolean;
}) {
  const [row] = await db
    .insert(features)
    .values({
      key: slugify(values.key || values.nameEn),
      category: values.category || 'general',
      nameBg: values.nameBg,
      nameEn: values.nameEn,
      icon: values.icon || null,
      sortOrder: values.sortOrder ?? 0,
      isFilterable: values.isFilterable ?? true,
    })
    .returning({ id: features.id });
  return row!.id;
}

export async function updateFeature(
  id: string,
  values: {
    key: string;
    category: string;
    nameBg: string;
    nameEn: string;
    icon?: string | null;
    sortOrder?: number;
    isFilterable?: boolean;
  },
) {
  await db
    .update(features)
    .set({
      key: slugify(values.key),
      category: values.category || 'general',
      nameBg: values.nameBg,
      nameEn: values.nameEn,
      icon: values.icon || null,
      sortOrder: values.sortOrder ?? 0,
      isFilterable: values.isFilterable ?? true,
    })
    .where(eq(features.id, id));
}

export async function deleteFeature(id: string) {
  await db.delete(features).where(eq(features.id, id));
}

export async function findLocationBySlugPair(slugBg: string, slugEn: string) {
  const [row] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.slugBg, slugBg), eq(locations.slugEn, slugEn)))
    .limit(1);
  return row ?? null;
}
