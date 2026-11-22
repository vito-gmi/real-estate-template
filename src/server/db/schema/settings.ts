import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Settings staff change at runtime from the admin console.
 *
 * One row per settings group, holding a JSON document validated by a Zod
 * schema on read. Defaults live in code, so a missing row (or a missing key in
 * an old row) simply means "the default" and adding a setting never needs a
 * migration.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export type AppSettingsRow = typeof appSettings.$inferSelect;
