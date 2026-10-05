import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Migration runner.
 *
 * Runs in three phases so that hand-written DDL and generated DDL can coexist:
 * extensions first (generated indexes depend on them), then Drizzle's ordered
 * migration files, then idempotent objects Drizzle cannot express.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations.");

  // `max: 1` because DDL must be serialised, and postgres.js would otherwise
  // spread statements across connections.
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    console.log("→ applying extensions");
    await sql.unsafe(await readFile(join(here, "sql/pre-migrate.sql"), "utf8"));

    console.log("→ applying migrations");
    await migrate(drizzle(sql), { migrationsFolder: join(here, "migrations") });

    console.log("→ applying views, functions and expression indexes");
    await sql.unsafe(
      await readFile(join(here, "sql/post-migrate.sql"), "utf8"),
    );

    console.log("✓ database is up to date");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error("✗ migration failed");
  console.error(error);
  process.exit(1);
});
