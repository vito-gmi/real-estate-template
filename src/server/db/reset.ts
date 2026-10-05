import "./script-env.ts";

import { sql } from "drizzle-orm";
import { db } from "./client.ts";

/** Drops every application object so migrations can be replayed from scratch. */
async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DB_RESET !== "yes"
  ) {
    throw new Error(
      "Refusing to reset a production database. Set ALLOW_DB_RESET=yes to override.",
    );
  }

  console.log("→ dropping schema");
  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);

  console.log("✓ schema reset — run `npm run db:migrate` next");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("✗ reset failed");
  console.error(error);
  process.exit(1);
});
