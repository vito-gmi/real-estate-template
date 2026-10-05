import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { listings } from './listings';

/**
 * Amenity tags (elevator, garage, sea view…). Kept as a taxonomy rather than
 * boolean columns so an agency can add "gated complex" without a migration.
 */
export const features = pgTable(
  'features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable machine key used in filter query strings, e.g. `elevator`. */
    key: text('key').notNull().unique(),
    /** Groups features in the filter panel: `building`, `interior`, `outdoor`… */
    category: text('category').notNull().default('general'),
    nameBg: text('name_bg').notNull(),
    nameEn: text('name_en').notNull(),
    /** lucide-react icon name, resolved at render time. */
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    isFilterable: boolean('is_filterable').notNull().default(true),
  },
  (table) => [index('features_category_idx').on(table.category, table.sortOrder)],
);

export const listingFeatures = pgTable(
  'listing_features',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.listingId, table.featureId] }),
    // Reverse lookup for "listings that have feature X".
    index('listing_features_feature_idx').on(table.featureId, table.listingId),
  ],
);

export const featuresRelations = relations(features, ({ many }) => ({
  listings: many(listingFeatures),
}));

export const listingFeaturesRelations = relations(listingFeatures, ({ one }) => ({
  listing: one(listings, { fields: [listingFeatures.listingId], references: [listings.id] }),
  feature: one(features, { fields: [listingFeatures.featureId], references: [features.id] }),
}));

export type FeatureRow = typeof features.$inferSelect;
export type NewFeatureRow = typeof features.$inferInsert;
