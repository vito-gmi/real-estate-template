import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * MapLibre v6's tile worker is a pair of ESM files that import each other by
 * relative path. Next.js (Turbopack and webpack) emits the worker with a hashed
 * name and does not place `maplibre-gl-shared.mjs` next to it, so the worker
 * dies on its first import and vector tiles never appear.
 *
 * Copying both files into `public/maplibre/` keeps that relative import intact
 * and gives `setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')` a same-origin URL.
 */
const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("maplibre-gl/package.json"));
const fromDir = join(packageDir, "dist");
const toDir = join(process.cwd(), "public", "maplibre");

mkdirSync(toDir, { recursive: true });

for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(fromDir, file), join(toDir, file));
}
