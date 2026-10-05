import 'server-only';

import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { auditLog } from '@/server/db/schema';

/**
 * Audit trail.
 *
 * Append-only: nothing in the application updates or deletes a row here. The
 * actor's email is denormalised so the record survives the account being
 * removed, which is precisely the situation in which the trail matters.
 */

export type AuditEntry = {
  readonly actorId?: string | null;
  readonly actorEmail: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly diff?: Record<string, { from: unknown; to: unknown }> | null;
  readonly ipHash?: string | null;
};

/**
 * Never throws. An audit write failing must not roll back the operation it was
 * describing, nor turn a successful publish into an error for the editor.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      diff: entry.diff ?? null,
      ipHash: entry.ipHash ?? null,
    });
  } catch (error) {
    console.error('[audit] failed to record entry', entry.action, error);
  }
}

export async function listAuditEntries(limit = 100, offset = 0) {
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(auditLog),
  ]);

  return { rows, total: Number(totals?.total ?? 0) };
}

export async function listAuditForEntity(entityType: string, entityId: string, limit = 30) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityId, entityId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/**
 * Shallow field-level diff, so the log records what changed rather than a full
 * copy of the row.
 */
export function diffOf<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    const previous = before[key];
    if (JSON.stringify(previous) !== JSON.stringify(value)) {
      diff[key] = { from: previous ?? null, to: value ?? null };
    }
  }
  return diff;
}
