"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { clientEnv } from "@/env";

/**
 * Click-to-place coordinate picker.
 *
 * Typing latitude and longitude by hand is error-prone and impossible to verify
 * at a glance; dragging a pin is neither. MapLibre is loaded dynamically so the
 * listing form stays light for the majority of edits that never open this tab.
 */
export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | undefined;
  lng: number | undefined;
  onChange: (position: { lat: number; lng: number }) => void;
}) {
  const t = useTranslations("admin");
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sofia, as a sensible default view for a Bulgarian agency.
  const initialLat = lat ?? 42.6977;
  const initialLng = lng ?? 23.3219;

  useEffect(() => {
    if (!containerRef.current) return;

    let map: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const { createMap, Marker, NavigationControl } = await import(
        "@/lib/maplibre-map"
      );

      if (cancelled || !containerRef.current) return;

      const instance = createMap(containerRef.current, {
        style: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL,
        center: [initialLng, initialLat],
        zoom: lat && lng ? 15 : 11,
      });

      instance.addControl(
        new NavigationControl({ showCompass: false }),
        "top-right",
      );

      const marker = new Marker({ color: "#2f4f7f", draggable: true })
        .setLngLat([initialLng, initialLat])
        .addTo(instance);

      marker.on("dragend", () => {
        const position = marker.getLngLat();
        onChangeRef.current({
          lat: Number(position.lat.toFixed(6)),
          lng: Number(position.lng.toFixed(6)),
        });
      });

      instance.on("click", (event) => {
        marker.setLngLat(event.lngLat);
        onChangeRef.current({
          lat: Number(event.lngLat.lat.toFixed(6)),
          lng: Number(event.lngLat.lng.toFixed(6)),
        });
      });

      map = instance;
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Rebuilding the map on every keystroke would be wasteful; the marker is
    // updated imperatively instead, so this mounts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-card border border-line bg-surface-sunken"
      />
      <p className="text-xs text-ink-subtle">{t("fields.pickOnMap")}</p>
    </div>
  );
}
