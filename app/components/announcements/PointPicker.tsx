"use client";

import { useEffect, useRef, useState } from "react";
import { addBaseLayer, loadLeaflet, type LatLng, type LMap, type LMarker } from "../leaflet";

// Petite carte pour placer un point (le rendez-vous d'une manifestation annoncée).
export default function PointPicker({
  value,
  onChange,
  label,
}: {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const marker = useRef<LMarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !el.current || map.current) return;
      map.current = L.map(el.current).setView(value ? [value.lat, value.lng] : [46.6, 2.4], value ? 15 : 5);
      addBaseLayer(L, map.current, el.current);
      map.current.getContainer().classList.add("map-picking");
      map.current.on("click", ({ latlng }) =>
        onChangeRef.current({ lat: Number(latlng.lat.toFixed(5)), lng: Number(latlng.lng.toFixed(5)) }),
      );
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la vue initiale n'est fixée qu'une fois
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!ready || !L || !map.current) return;
    marker.current?.remove();
    marker.current = null;
    if (!value) return;
    marker.current = L.marker([value.lat, value.lng], {
      icon: L.divIcon({ className: "report-pin report-pin-draft", html: "<span>📍</span>", iconSize: [34, 34] }),
      keyboard: false,
    }).addTo(map.current);
    if (map.current.getZoom() < 13) map.current.setView([value.lat, value.lng], 15);
  }, [value, ready]);

  return (
    <div
      ref={el}
      dir="ltr"
      role="application"
      aria-label={label}
      className="h-72 w-full rounded-[3px] border-[1.5px] border-encre z-0"
    />
  );
}
