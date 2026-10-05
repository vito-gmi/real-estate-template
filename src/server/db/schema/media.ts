import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { MediaVariant } from '@/lib/domain/media';
import { mediaKindEnum } from './enums';
import { listings } from './listings';

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    kind: mediaKindEnum('kind').notNull().default('photo'),

    /** Object-storage key of the untouched upload, kept so derivatives can be
     *  regenerated if the derivative set ever changes. */
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    bytes: integer('bytes').notNull(),

    /** Intrinsic dimensions. Rendering them as width/height attributes is what
     *  keeps cumulative layout shift at zero. */
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    /** Tiny inline preview shown while the real image decodes. */
    blurDataUrl: text('blur_data_url'),

    variants: jsonb('variants').$type<MediaVariant[]>().notNull().default([]),

    altBg: text('alt_bg'),
    altEn: text('alt_en'),

    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('media_listing_idx').on(table.listingId, table.kind, table.sortOrder),
    index('media_storage_key_idx').on(table.storageKey),
  ],
);

export const mediaRelations = relations(media, ({ one }) => ({
  listing: one(listings, { fields: [media.listingId], references: [listings.id] }),
}));

export type MediaRow = typeof media.$inferSelect;
export type NewMediaRow = typeof media.$inferInsert;
