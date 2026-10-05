"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { clientEnv } from "@/env";

/**
 * Map preview for a listing.
 *
 * MapLibre is a large dependency, so it is imported dynamically. Tiles come
 * from OpenFreeMap, which needs no API key — one less credential for anyone
 * forking this template.
 */
export function PropertyMap({
  lat,
  lng,
  approximate,
  label,
}: {
  lat: number;
  lng: number;
  approximate: boolean;
  label: string;
}) {
  const t = useTranslations("listing");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let map: { remove: () => void; resize: () => void } | undefined;
    let cancelled = false;
    let resizeTimer: number | undefined;

    void (async () => {
      try {
        const { createMap, Marker, NavigationControl } = await import(
          "@/lib/maplibre-map"
        );

        if (cancelled || !containerRef.current) return;

        const instance = createMap(containerRef.current, {
          style: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL,
          center: [lng, lat],
          zoom: approximate ? 13 : 15.5,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });

        instance.addControl(
          new NavigationControl({ showCompass: false }),
          "top-right",
        );

        const resize = () => {
          if (!cancelled) instance.resize();
        };

        instance.once("load", resize);
        requestAnimationFrame(resize);
        resizeTimer = window.setTimeout(resize, 400);

        if (approximate) {
          // A circle rather than a pin, because the coordinates were deliberately
          // rounded — a precise-looking marker would misrepresent the data.
          instance.on("load", () => {
            if (instance.getSource("area")) return;
            instance.addSource("area", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: { type: "Point", coordinates: [lng, lat] },
                properties: {},
              },
            });
            instance.addLayer({
              id: "area-fill",
              type: "circle",
              source: "area",
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  11,
                  20,
                  16,
                  90,
                ],
                "circle-color": "#2f4f7f",
                "circle-opacity": 0.22,
                "circle-stroke-color": "#2f4f7f",
                "circle-stroke-width": 1.5,
                "circle-stroke-opacity": 0.5,
              },
            });
          });
        } else {
          new Marker({ color: "#2f4f7f" }).setLngLat([lng, lat]).addTo(instance);
        }

        map = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      map?.remove();
    };
  }, [lat, lng, approximate]);

  return (
    <section aria-label={t("location")}>
      <div className="relative overflow-hidden rounded-card border border-line">
        <div
          ref={containerRef}
          role="img"
          aria-label={label}
          className="h-72 w-full bg-surface-sunken"
        />
        {failed ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-ink-subtle">
            <div>
              <MapPin className="mx-auto size-8" aria-hidden="true" />
              <p className="mt-2 text-sm">{t("mapUnavailable")}</p>
            </div>
          </div>
        ) : null}
      </div>
      {approximate ? (
        <p className="mt-2 text-xs text-ink-subtle">
          {t("approximateLocation")}
        </p>
      ) : null}
    </section>
  );
}
