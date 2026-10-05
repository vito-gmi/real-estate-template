"use client";

import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type MapOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Next.js does not emit MapLibre's worker next to its sibling shared chunk
 * (see scripts/copy-maplibre-worker.mjs). Pointing at the copied public files
 * is what actually lets vector tiles parse.
 */
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

let workerConfigured = false;

function ensureWorkerUrl() {
  if (workerConfigured) return;
  setWorkerUrl(WORKER_URL);
  workerConfigured = true;
}

export function createMap(
  container: HTMLElement,
  options: Omit<MapOptions, "container">,
): MapLibreMap {
  ensureWorkerUrl();
  const map = new MapLibreMap({ ...options, container });

  // Tabs, lazy mount, and flex layouts often give the canvas a 0×0 size on the
  // first paint. Without a resize, clicks miss the map and tiles never fill.
  const resize = () => map.resize();
  requestAnimationFrame(resize);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  map.once("remove", () => observer.disconnect());

  return map;
}

export { Marker, NavigationControl };
