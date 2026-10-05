import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Append-only record of every administrative mutation.
 *
 * The actor's email is copied in rather than only referenced, so the trail
 * survives the user account being deleted — which is exactly when you need it.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email').notNull(),

    /** `listing.publish`, `media.delete`, `inquiry.status_change`… */
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    /** Shallow before/after of the changed fields only. */
    diff: jsonb('diff').$type<Record<string, { from: unknown; to: unknown }>>(),

    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_recent_idx').on(table.createdAt),
    index('audit_log_entity_idx').on(table.entityType, table.entityId, table.createdAt),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
