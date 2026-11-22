import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CoverImage } from '@/lib/domain/media';
import { tsvector } from './columns';
import {
  conditionEnum,
  constructionTypeEnum,
  currencyEnum,
  dealTypeEnum,
  furnishingEnum,
  heatingTypeEnum,
  listingStatusEnum,
  localeEnum,
  propertyKindEnum,
} from './enums';
import { locations } from './locations';
import { users } from './auth';

/** Fixed BGN↔EUR peg, inlined into generated columns so Postgres can sort on price. */
const BGN_PER_EUR = sql.raw('1.95583');

/**
 * The hot table.
 *
 * Every column a visitor can filter or sort by lives here, denormalised on
 * purpose — including `cityId`/`regionId`, which are copied down from the
 * location hierarchy. That lets the search query stay single-table and be
 * satisfied entirely by composite indexes, which is what keeps response times
 * identical at 50 listings and at 50,000.
 */
export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Human-friendly number agents quote on the phone, e.g. "ID 100427". */
    reference: integer('reference')
      .notNull()
      .generatedByDefaultAsIdentity({ name: 'listings_reference_seq', startWith: 100_000 }),

    dealType: dealTypeEnum('deal_type').notNull(),
    propertyKind: propertyKindEnum('property_kind').notNull(),
    status: listingStatusEnum('status').notNull().default('draft'),

    /**
     * The asking price. Optional: an agency may list "price on request" and
     * never enter one. When `showPrice` is off, the stored amount stays here so
     * re-enabling it restores the old price, but it never leaves the server.
     */
    price: numeric('price', { precision: 12, scale: 2, mode: 'number' }),
    currency: currencyEnum('currency').notNull().default('EUR'),
    /** Off by default: new listings are "price on request" until an agent opts in. */
    showPrice: boolean('show_price').notNull().default(false),

    /*
     * Public price columns.
     *
     * Every column below is what search filters and sorts on, so each one is
     * null (or a sentinel) when the price is hidden. If they were derived from
     * `price` alone, a visitor could recover a hidden price by narrowing the
     * price filter, or read its rank from the sort order.
     */

    /** Normalised price so mixed-currency listings sort correctly. */
    priceEur: numeric('price_eur', { precision: 12, scale: 2, mode: 'number' }).generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`(case when ${listings.showPrice} then (case when ${listings.currency} = 'EUR' then ${listings.price} else round(${listings.price} / ${BGN_PER_EUR}, 2) end) end)`,
    ),

    area: numeric('area', { precision: 10, scale: 2, mode: 'number' }),
    landArea: numeric('land_area', { precision: 12, scale: 2, mode: 'number' }),

    /**
     * Derived from the base columns rather than from `price_eur`, because
     * Postgres forbids a generated column referencing another generated column.
     * Null when the listing has no measurable area or a hidden price, so the UI
     * can hide the field.
     */
    pricePerSqmEur: numeric('price_per_sqm_eur', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`(case when ${listings.showPrice} and coalesce(${listings.area}, ${listings.landArea}) > 0 then round((case when ${listings.currency} = 'EUR' then ${listings.price} else ${listings.price} / ${BGN_PER_EUR} end) / coalesce(${listings.area}, ${listings.landArea}), 2) end)`,
    ),

    /*
     * Sort keys.
     *
     * Keyset pagination compares a row against the last row of the previous
     * page. That comparison is only sound — and only index-friendly — when the
     * sort key can never be null, so these columns collapse "indoor area or
     * plot area" into one value and give listings without a value a sentinel
     * that parks them at the end of the sort. Price gets one key per direction
     * because a single sentinel can only sit at one end.
     */
    sortArea: numeric('sort_area', { precision: 12, scale: 2, mode: 'number' })
      .notNull()
      .generatedAlwaysAs(
        (): ReturnType<typeof sql> =>
          sql`coalesce(${listings.area}, ${listings.landArea}, 0)`,
      ),

    sortPriceAsc: numeric('sort_price_asc', { precision: 12, scale: 2, mode: 'number' })
      .notNull()
      .generatedAlwaysAs(
        (): ReturnType<typeof sql> =>
          sql`(case when ${listings.showPrice} then (case when ${listings.currency} = 'EUR' then ${listings.price} else round(${listings.price} / ${BGN_PER_EUR}, 2) end) else 999999999 end)`,
      ),

    sortPriceDesc: numeric('sort_price_desc', { precision: 12, scale: 2, mode: 'number' })
      .notNull()
      .generatedAlwaysAs(
        (): ReturnType<typeof sql> =>
          sql`(case when ${listings.showPrice} then (case when ${listings.currency} = 'EUR' then ${listings.price} else round(${listings.price} / ${BGN_PER_EUR}, 2) end) else -1 end)`,
      ),

    sortPricePerSqm: numeric('sort_price_per_sqm', { precision: 12, scale: 2, mode: 'number' })
      .notNull()
      .generatedAlwaysAs(
        (): ReturnType<typeof sql> =>
          sql`(case when ${listings.showPrice} and coalesce(${listings.area}, ${listings.landArea}) > 0 then round((case when ${listings.currency} = 'EUR' then ${listings.price} else ${listings.price} / ${BGN_PER_EUR} end) / coalesce(${listings.area}, ${listings.landArea}), 2) else 999999999 end)`,
      ),

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
    energyLabel: text('energy_label'),

    /** Rentals only. */
    maintenanceFee: numeric('maintenance_fee', { precision: 10, scale: 2, mode: 'number' }),
    depositMonths: integer('deposit_months'),
    availableFrom: date('available_from'),

    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    /** Copied from the hierarchy so filters never have to walk parents. */
    cityId: uuid('city_id').references(() => locations.id, { onDelete: 'restrict' }),
    regionId: uuid('region_id').references(() => locations.id, { onDelete: 'restrict' }),

    address: text('address'),
    hideExactAddress: boolean('hide_exact_address').notNull().default(true),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),

    coverImage: jsonb('cover_image').$type<CoverImage | null>(),
    videoUrl: text('video_url'),

    isFeatured: boolean('is_featured').notNull().default(false),
    isExclusive: boolean('is_exclusive').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('listings_reference_key').on(table.reference),

    // The default browse order: newest first, with `id` as the tie-breaker that
    // makes keyset pagination stable.
    index('listings_browse_idx').on(
      table.status,
      table.dealType,
      sql`${table.publishedAt} desc nulls last`,
      sql`${table.id} desc`,
    ),

    // Covers the common "kind + city within a price band" filter.
    index('listings_facet_idx').on(
      table.status,
      table.dealType,
      table.propertyKind,
      table.cityId,
      table.priceEur,
    ),

    index('listings_price_asc_sort_idx').on(
      table.status,
      table.dealType,
      table.sortPriceAsc,
      table.id,
    ),
    index('listings_price_desc_sort_idx').on(
      table.status,
      table.dealType,
      sql`${table.sortPriceDesc} desc`,
      sql`${table.id} desc`,
    ),
    index('listings_area_sort_idx').on(
      table.status,
      table.dealType,
      sql`${table.sortArea} desc`,
      sql`${table.id} desc`,
    ),
    index('listings_ppsqm_sort_idx').on(
      table.status,
      table.dealType,
      table.sortPricePerSqm,
      table.id,
    ),

    index('listings_region_idx').on(table.status, table.regionId),
    index('listings_location_idx').on(table.status, table.locationId),
    index('listings_featured_idx')
      .on(sql`${table.publishedAt} desc`)
      .where(sql`${table.isFeatured} and ${table.status} = 'active'`),
    index('listings_admin_idx').on(table.status, sql`${table.updatedAt} desc`),

    // A price can be hidden without one, but never shown without one.
    check('listings_shown_price_present', sql`not ${table.showPrice} or ${table.price} is not null`),
  ],
);

/**
 * Per-locale content. Splitting it out keeps the hot table narrow and gives each
 * language its own slug and its own full-text index.
 */
export const listingTranslations = pgTable(
  'listing_translations',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    locale: localeEnum('locale').notNull(),

    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    slug: text('slug').notNull(),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),

    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`to_tsvector('simple', coalesce(${listingTranslations.title}, '') || ' ' || coalesce(${listingTranslations.description}, ''))`,
    ),
  },
  (table) => [
    primaryKey({ columns: [table.listingId, table.locale] }),
    uniqueIndex('listing_translations_slug_key').on(table.locale, table.slug),
    index('listing_translations_search_idx').using('gin', table.searchVector),
    index('listing_translations_title_trgm_idx').using(
      'gin',
      sql`${table.title} gin_trgm_ops`,
    ),
  ],
);

export const listingsRelations = relations(listings, ({ one, many }) => ({
  translations: many(listingTranslations),
  location: one(locations, { fields: [listings.locationId], references: [locations.id] }),
  city: one(locations, { fields: [listings.cityId], references: [locations.id] }),
  region: one(locations, { fields: [listings.regionId], references: [locations.id] }),
}));

export const listingTranslationsRelations = relations(listingTranslations, ({ one }) => ({
  listing: one(listings, {
    fields: [listingTranslations.listingId],
    references: [listings.id],
  }),
}));

export type ListingRow = typeof listings.$inferSelect;
export type NewListingRow = typeof listings.$inferInsert;
export type ListingTranslationRow = typeof listingTranslations.$inferSelect;
export type NewListingTranslationRow = typeof listingTranslations.$inferInsert;
