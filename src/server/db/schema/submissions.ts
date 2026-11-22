import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  conditionEnum,
  constructionTypeEnum,
  currencyEnum,
  dealTypeEnum,
  furnishingEnum,
  heatingTypeEnum,
  localeEnum,
  propertyKindEnum,
  submissionStatusEnum,
  submitterRoleEnum,
} from './enums';
import { listings } from './listings';
import { locations } from './locations';
import { media } from './media';
import { users } from './auth';

/**
 * Properties offered by visitors through the public "list your property" form.
 *
 * Deliberately not a draft row in `listings`: that table is the search hot path
 * (non-null location, bilingual titles, facet counts), and nothing a stranger
 * types should touch it before a person has looked at it. A submission also
 * carries the owner's personal data, which listings have no place for and
 * which follows its own retention rules.
 *
 * The property columns reuse the listing enums, so approving a submission is a
 * column-for-column copy rather than a translation between vocabularies.
 */
export const propertySubmissions = pgTable(
  'property_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Quoted back to the visitor and on the phone: "submission 1042". */
    reference: integer('reference')
      .notNull()
      .generatedByDefaultAsIdentity({ name: 'property_submissions_reference_seq', startWith: 1000 }),
    status: submissionStatusEnum('status').notNull().default('incomplete'),

    // Nullable until the visitor submits: an `incomplete` row is created as soon
    // as the first photo is added, before the property fields are known.
    dealType: dealTypeEnum('deal_type'),
    propertyKind: propertyKindEnum('property_kind'),

    /** The most specific place the visitor picked (district, else city). */
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    /** Free text for a place missing from the taxonomy. */
    locationText: text('location_text'),
    /** Never published as typed; the agent decides what becomes public. */
    address: text('address'),

    price: numeric('price', { precision: 12, scale: 2, mode: 'number' }),
    currency: currencyEnum('currency').notNull().default('EUR'),

    area: numeric('area', { precision: 10, scale: 2, mode: 'number' }),
    landArea: numeric('land_area', { precision: 12, scale: 2, mode: 'number' }),
    rooms: integer('rooms'),
    bedrooms: integer('bedrooms'),
    bathrooms: integer('bathrooms'),
    floor: integer('floor'),
    floorsTotal: integer('floors_total'),
    yearBuilt: integer('year_built'),
    constructionType: constructionTypeEnum('construction_type'),
    heating: heatingTypeEnum('heating'),
    furnishing: furnishingEnum('furnishing'),
    condition: conditionEnum('condition'),
    featureKeys: text('feature_keys').array().notNull().default(sql`'{}'::text[]`),

    /** Rentals only. */
    maintenanceFee: numeric('maintenance_fee', { precision: 10, scale: 2, mode: 'number' }),
    depositMonths: integer('deposit_months'),
    availableFrom: date('available_from'),

    description: text('description').notNull().default(''),
    /** A Drive/Dropbox/WeTransfer folder or a video, for what does not fit the form. */
    externalMediaUrl: text('external_media_url'),
    /** The language the visitor wrote in, and the one we reply in. */
    locale: localeEnum('locale').notNull().default('bg'),

    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),
    submitterRole: submitterRoleEnum('submitter_role'),
    contactTime: text('contact_time'),

    consentAt: timestamp('consent_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),

    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    internalNote: text('internal_note'),
    /** The draft listing created on approval. */
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),

    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('property_submissions_reference_key').on(table.reference),
    index('property_submissions_queue_idx').on(table.status, sql`${table.submittedAt} desc`),
    // The cleanup job sweeps by status and age.
    index('property_submissions_cleanup_idx').on(table.status, table.updatedAt),
    index('property_submissions_listing_idx').on(table.listingId),
  ],
);

/**
 * Photos attached to a submission.
 *
 * The objects live in the private bucket, never the public media bucket: until
 * someone has reviewed them they are a stranger's files, and a public bucket
 * would turn the form into free image hosting on the agency's domain.
 */
export const submissionPhotos = pgTable(
  'submission_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => propertySubmissions.id, { onDelete: 'cascade' }),

    /** Normalised JPEG (rotated, metadata stripped) in private storage. */
    storageKey: text('storage_key').notNull(),
    /** Small WebP for the review grid. */
    thumbKey: text('thumb_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),

    /** Set once the photo has been copied into the listing's public media. */
    importedMediaId: uuid('imported_media_id').references(() => media.id, { onDelete: 'set null' }),
    /** Cleared by the cleanup job after the private objects are deleted. */
    purgedAt: timestamp('purged_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('submission_photos_submission_idx').on(table.submissionId, table.sortOrder)],
);

export const propertySubmissionsRelations = relations(propertySubmissions, ({ one, many }) => ({
  photos: many(submissionPhotos),
  location: one(locations, { fields: [propertySubmissions.locationId], references: [locations.id] }),
  listing: one(listings, { fields: [propertySubmissions.listingId], references: [listings.id] }),
  reviewer: one(users, { fields: [propertySubmissions.reviewedBy], references: [users.id] }),
}));

export const submissionPhotosRelations = relations(submissionPhotos, ({ one }) => ({
  submission: one(propertySubmissions, {
    fields: [submissionPhotos.submissionId],
    references: [propertySubmissions.id],
  }),
}));

export type PropertySubmissionRow = typeof propertySubmissions.$inferSelect;
export type NewPropertySubmissionRow = typeof propertySubmissions.$inferInsert;
export type SubmissionPhotoRow = typeof submissionPhotos.$inferSelect;
