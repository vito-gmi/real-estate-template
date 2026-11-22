import 'server-only';

import { and, asc, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Locale } from '@/i18n/routing';
import type { SubmissionStatus } from '@/lib/domain/enums';
import { db } from '@/server/db/client';
import {
  listingTranslations,
  listings,
  locations,
  propertySubmissions,
  submissionPhotos,
  type NewPropertySubmissionRow,
  type PropertySubmissionRow,
  type SubmissionPhotoRow,
} from '@/server/db/schema';

const parentLocations = alias(locations, 'parent_location');

/**
 * Property submissions from the public form.
 *
 * Everything that touches `property_submissions` and `submission_photos` goes
 * through here; the use cases never see Drizzle.
 */

export async function createIncompleteSubmission(input: {
  locale: Locale;
  ipHash: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(propertySubmissions)
    .values({ status: 'incomplete', locale: input.locale, ipHash: input.ipHash })
    .returning({ id: propertySubmissions.id });
  return row!;
}

export async function getSubmission(id: string): Promise<PropertySubmissionRow | null> {
  const [row] = await db
    .select()
    .from(propertySubmissions)
    .where(eq(propertySubmissions.id, id))
    .limit(1);
  return row ?? null;
}

export async function getSubmissionByListingId(listingId: string): Promise<PropertySubmissionRow | null> {
  const [row] = await db
    .select()
    .from(propertySubmissions)
    .where(eq(propertySubmissions.listingId, listingId))
    .limit(1);
  return row ?? null;
}

export async function updateSubmission(
  id: string,
  values: Partial<NewPropertySubmissionRow>,
): Promise<void> {
  await db
    .update(propertySubmissions)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(propertySubmissions.id, id));
}

/**
 * Moves a submission from one status to another only if it is still in the
 * expected one, so two reviewers clicking at once cannot both act on it.
 */
export async function transitionSubmission(
  id: string,
  from: readonly SubmissionStatus[],
  values: Partial<NewPropertySubmissionRow> & { status: SubmissionStatus },
): Promise<boolean> {
  const rows = await db
    .update(propertySubmissions)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(propertySubmissions.id, id), inArray(propertySubmissions.status, [...from])))
    .returning({ id: propertySubmissions.id });
  return rows.length > 0;
}

export async function deleteSubmissionRow(id: string): Promise<void> {
  await db.delete(propertySubmissions).where(eq(propertySubmissions.id, id));
}

// --- Photos ------------------------------------------------------------------

export async function listSubmissionPhotos(submissionId: string): Promise<SubmissionPhotoRow[]> {
  return db
    .select()
    .from(submissionPhotos)
    .where(eq(submissionPhotos.submissionId, submissionId))
    .orderBy(asc(submissionPhotos.sortOrder), asc(submissionPhotos.createdAt));
}

export async function countSubmissionPhotos(submissionId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(submissionPhotos)
    .where(eq(submissionPhotos.submissionId, submissionId));
  return Number(row?.total ?? 0);
}

export async function getSubmissionPhoto(id: string): Promise<SubmissionPhotoRow | null> {
  const [row] = await db.select().from(submissionPhotos).where(eq(submissionPhotos.id, id)).limit(1);
  return row ?? null;
}

export async function insertSubmissionPhoto(values: {
  submissionId: string;
  storageKey: string;
  thumbKey: string;
  width: number;
  height: number;
  bytes: number;
  sortOrder: number;
}): Promise<{ id: string }> {
  const [row] = await db.insert(submissionPhotos).values(values).returning({ id: submissionPhotos.id });
  return row!;
}

export async function deleteSubmissionPhotos(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(submissionPhotos).where(inArray(submissionPhotos.id, [...ids]));
}

/** Writes the visitor's chosen order in one statement. */
export async function setSubmissionPhotoOrder(
  submissionId: string,
  orderedIds: readonly string[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(submissionPhotos)
        .set({ sortOrder: index })
        .where(and(eq(submissionPhotos.id, id), eq(submissionPhotos.submissionId, submissionId)));
    }
  });
}

export async function markSubmissionPhotoImported(id: string, mediaId: string): Promise<void> {
  await db.update(submissionPhotos).set({ importedMediaId: mediaId }).where(eq(submissionPhotos.id, id));
}

export async function markSubmissionPhotosPurged(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(submissionPhotos)
    .set({ purgedAt: new Date() })
    .where(inArray(submissionPhotos.id, [...ids]));
}

// --- Review queue ------------------------------------------------------------

export type SubmissionListItem = {
  readonly id: string;
  readonly reference: number;
  readonly status: SubmissionStatus;
  readonly dealType: PropertySubmissionRow['dealType'];
  readonly propertyKind: PropertySubmissionRow['propertyKind'];
  readonly locationName: string | null;
  readonly parentName: string | null;
  readonly locationText: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly price: number | null;
  readonly currency: PropertySubmissionRow['currency'];
  readonly photoCount: number;
  readonly submittedAt: Date | null;
};

export async function listSubmissions(options: {
  locale: Locale;
  statuses: readonly SubmissionStatus[];
  limit?: number;
}): Promise<readonly SubmissionListItem[]> {
  const bg = options.locale === 'bg';

  const rows = await db
    .select({
      id: propertySubmissions.id,
      reference: propertySubmissions.reference,
      status: propertySubmissions.status,
      dealType: propertySubmissions.dealType,
      propertyKind: propertySubmissions.propertyKind,
      locationName: bg ? locations.nameBg : locations.nameEn,
      parentName: bg ? parentLocations.nameBg : parentLocations.nameEn,
      locationText: propertySubmissions.locationText,
      firstName: propertySubmissions.firstName,
      lastName: propertySubmissions.lastName,
      phone: propertySubmissions.phone,
      price: propertySubmissions.price,
      currency: propertySubmissions.currency,
      photoCount: sql<number>`(select count(*)::int from submission_photos sp where sp.submission_id = ${propertySubmissions.id})`,
      submittedAt: propertySubmissions.submittedAt,
    })
    .from(propertySubmissions)
    .leftJoin(locations, eq(locations.id, propertySubmissions.locationId))
    .leftJoin(parentLocations, eq(parentLocations.id, locations.parentId))
    .where(inArray(propertySubmissions.status, [...options.statuses]))
    .orderBy(desc(propertySubmissions.submittedAt))
    .limit(options.limit ?? 100);

  return rows.map((row) => ({ ...row, photoCount: Number(row.photoCount) }));
}

export async function countSubmissionsByStatus(status: SubmissionStatus): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(propertySubmissions)
    .where(eq(propertySubmissions.status, status));
  return Number(row?.total ?? 0);
}

/** The picked place with its parent, in both languages, for titles and display. */
export async function getSubmissionPlace(locationId: string): Promise<{
  id: string;
  level: string;
  parentId: string | null;
  nameBg: string;
  nameEn: string;
  parentNameBg: string | null;
  parentNameEn: string | null;
} | null> {
  const [row] = await db
    .select({
      id: locations.id,
      level: locations.level,
      parentId: locations.parentId,
      nameBg: locations.nameBg,
      nameEn: locations.nameEn,
      parentNameBg: parentLocations.nameBg,
      parentNameEn: parentLocations.nameEn,
    })
    .from(locations)
    .leftJoin(parentLocations, eq(parentLocations.id, locations.parentId))
    .where(eq(locations.id, locationId))
    .limit(1);
  return row ?? null;
}

/** Checks a city/district pair from the public form against the taxonomy. */
export async function resolveSubmittedPlace(
  cityId: string | undefined,
  districtId: string | undefined,
): Promise<string | null> {
  const ids = [cityId, districtId].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;

  const rows = await db
    .select({ id: locations.id, level: locations.level, parentId: locations.parentId })
    .from(locations)
    .where(and(inArray(locations.id, ids), eq(locations.isActive, true)));

  const city = rows.find((row) => row.id === cityId && row.level === 'city');
  const district = rows.find((row) => row.id === districtId && row.level === 'district');

  // A district only counts if it belongs to the chosen city (or if no city was sent).
  if (district && (!city || district.parentId === city.id)) return district.id;
  return city?.id ?? null;
}

// --- Retention ---------------------------------------------------------------

export async function listStaleSubmissions(
  statuses: readonly SubmissionStatus[],
  olderThan: Date,
  limit = 200,
): Promise<{ id: string }[]> {
  return db
    .select({ id: propertySubmissions.id })
    .from(propertySubmissions)
    .where(and(inArray(propertySubmissions.status, [...statuses]), lt(propertySubmissions.updatedAt, olderThan)))
    .limit(limit);
}

/** Approved submissions whose private photo copies are due for deletion. */
export async function listUnpurgedPhotosOfReviewed(
  olderThan: Date,
  limit = 500,
): Promise<SubmissionPhotoRow[]> {
  return db
    .select({ photo: submissionPhotos })
    .from(submissionPhotos)
    .innerJoin(propertySubmissions, eq(propertySubmissions.id, submissionPhotos.submissionId))
    .where(
      and(
        eq(propertySubmissions.status, 'approved'),
        lt(propertySubmissions.reviewedAt, olderThan),
        isNull(submissionPhotos.purgedAt),
      ),
    )
    .limit(limit)
    .then((rows) => rows.map((row) => row.photo));
}

/** Title of the listing created from a submission, for the review page link. */
export async function getListingSummary(
  listingId: string,
  locale: Locale,
): Promise<{ reference: number; title: string | null; status: string } | null> {
  const [row] = await db
    .select({
      reference: listings.reference,
      status: listings.status,
      title: listingTranslations.title,
    })
    .from(listings)
    .leftJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, locale)),
    )
    .where(eq(listings.id, listingId))
    .limit(1);
  return row ?? null;
}
