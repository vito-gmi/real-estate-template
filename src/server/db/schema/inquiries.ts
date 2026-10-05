import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { inquiryKindEnum, inquiryStatusEnum, localeEnum } from './enums';
import { listings } from './listings';
import { users } from './auth';

/**
 * Leads captured from the public site.
 *
 * The visitor's IP is never stored in the clear — only a salted hash, which is
 * enough to rate-limit and spot abuse while keeping the record non-identifying.
 */
export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),

    kind: inquiryKindEnum('kind').notNull().default('message'),
    status: inquiryStatusEnum('status').notNull().default('new'),

    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    message: text('message').notNull().default(''),
    locale: localeEnum('locale').notNull().default('bg'),

    /** Where the lead came from: `listing`, `contact`, `callback`. */
    source: text('source').notNull().default('listing'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),

    handledBy: text('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    internalNote: text('internal_note'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('inquiries_inbox_idx').on(table.status, table.createdAt),
    index('inquiries_listing_idx').on(table.listingId, table.createdAt),
    index('inquiries_ip_idx').on(table.ipHash, table.createdAt),
  ],
);

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  listing: one(listings, { fields: [inquiries.listingId], references: [listings.id] }),
  handler: one(users, { fields: [inquiries.handledBy], references: [users.id] }),
}));

export type InquiryRow = typeof inquiries.$inferSelect;
export type NewInquiryRow = typeof inquiries.$inferInsert;
