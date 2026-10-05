import { config } from "dotenv";

/**
 * Loads `.env.local` before anything that reads `process.env` is imported.
 *
 * Scripts must list this as their first import: ES modules evaluate their
 * dependencies in declaration order, so importing it first guarantees the
 * environment is populated before `src/env.ts` validates it.
 */
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
