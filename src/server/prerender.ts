import 'server-only';

import { connection } from 'next/server';

/**
 * Call first in a page or route that reads the database and would otherwise be
 * prerendered by `next build` (the home page, `/sitemap.xml`).
 *
 * A build that has a database — Vercel, CI — prerenders them as usual. The
 * Docker image is built without one (its build stage has no `DATABASE_URL`),
 * where the query would fail with ECONNREFUSED and abort the whole build; there
 * these pages are left to render on their first request instead. At runtime
 * `DATABASE_URL` is always set, so this is a no-op.
 *
 * `connection()` is Next's documented way to say "wait for a real request"
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md).
 */
export async function deferIfBuildingWithoutDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) await connection();
}
