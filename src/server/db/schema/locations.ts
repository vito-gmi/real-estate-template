import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { locationLevelEnum } from './enums';

/**
 * A self-referencing hierarchy: country → region (oblast) → city → district.
 *
 * Slugs are stored per locale so `/bg/prodazhba/sofia/lozenets` and
 * `/en/for-sale/sofia/lozenets` are both first-class, indexable URLs.
 */
export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Self-reference: the return type is annotated explicitly because the table
    // is still being defined at the point the callback is declared.
    parentId: uuid('parent_id').references((): AnyPgColumn => locations.id, {
      onDelete: 'restrict',
    }),
    level: locationLevelEnum('level').notNull(),

    nameBg: text('name_bg').notNull(),
    nameEn: text('name_en').notNull(),
    slugBg: text('slug_bg').notNull(),
    slugEn: text('slug_en').notNull(),

    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),

    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Slugs only need to be unique among siblings, which lets two different
    // cities each have a "center" district.
    uniqueIndex('locations_parent_slug_bg_key').on(
      sql`coalesce(${table.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.slugBg,
    ),
    uniqueIndex('locations_parent_slug_en_key').on(
      sql`coalesce(${table.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.slugEn,
    ),
    index('locations_level_idx').on(table.level, table.sortOrder),
    index('locations_parent_idx').on(table.parentId),
  ],
);

export const locationsRelations = relations(locations, ({ one, many }) => ({
  parent: one(locations, {
    fields: [locations.parentId],
    references: [locations.id],
    relationName: 'location_parent',
  }),
  children: many(locations, { relationName: 'location_parent' }),
}));

export type LocationRow = typeof locations.$inferSelect;
export type NewLocationRow = typeof locations.$inferInsert;
