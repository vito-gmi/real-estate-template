import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/env";
import * as schema from "./schema";

/**
 * Low-level database handle.
 *
 * Deliberately free of `server-only` so CLI scripts (migrate, seed, benchmarks)
 * can import it under plain Node. The guard against pulling the database into a
 * client bundle lives one layer up, in the repository barrel that application
 * code actually imports.
 *
 * One connection pool per process.
 *
 * Next.js re-evaluates modules on every hot reload in development, which would
 * otherwise leak a pool per edit until Postgres refuses new connections. Caching
 * on `globalThis` is the standard escape hatch.
 */
const globalForDb = globalThis as unknown as {
  estateSql?: ReturnType<typeof postgres>;
};

function createClient() {
  return postgres(serverEnv.DATABASE_URL, {
    // Serverless functions are short-lived and numerous; a small ceiling per
    // instance keeps the total under Neon's pooled connection limit.
    max: serverEnv.DATABASE_MAX_CONNECTIONS,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

const client = globalForDb.estateSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.estateSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
export type Database = typeof db;
