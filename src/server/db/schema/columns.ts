import { customType } from 'drizzle-orm/pg-core';

/**
 * Postgres full-text search vector.
 *
 * Drizzle has no built-in `tsvector`, and we never read the column from the
 * application — it exists purely so Postgres can maintain a GIN index over a
 * generated expression — so a thin custom type is all that is needed.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});
