"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ManifestationEvent, ManifestationsResult } from "@/lib/manifestations";

const LEAFLET_VERSION = "1.9.4";
const REFRESH_MS = 15 * 60 * 1000;

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  "141": { label: "Manifestation / rassemblement", color: "#2563eb" },
  "143": { label: "Grève / boycott", color: "#d97706" },
  "144": { label: "Blocage / occupation", color: "#7c3aed" },
  "145": { label: "Émeute / violences", color: "#dc2626" },
  "142": { label: "Grève de la faim", color: "#0d9488" },
  "140": { label: "Autre protestation", color: "#6b7280" },
};

type Place = {
  key: string;
  location: string;
  lat: number;
  lng: number;
  events: ManifestationEvent[];
  mentions: number;
  mainType: string;
};

// Leaflet est chargé depuis le CDN : on ne type que ce qui est utilisé ici.
interface LLayer {
  addTo(target: LMap | LLayerGroup): this;
}
interface LMap {
  setView(center: [number, number], zoom: number): LMap;
  remove(): void;
}
interface LLayerGroup extends LLayer {
  clearLayers(): void;
}
interface LCircleMarker extends LLayer {
  bindPopup(html: string, options?: { maxWidth?: number }): LCircleMarker;
  bindTooltip(text: string): LCircleMarker;
  openPopup(): void;
}
interface LStatic {
  map(el: HTMLElement, options?: { preferCanvas?: boolean }): LMap;
  tileLayer(url: string, options: { maxZoom: number; attribution: string }): LLayer;
  layerGroup(): LLayerGroup;
  circleMarker(
    latlng: [number, number],
    options: { radius: number; color: string; fillColor: string; fillOpacity: number; weight: number },
  ): LCircleMarker;
}

declare global {
  interface Window {
    L?: LStatic;
  }
}

function loadLeaflet(): Promise<LStatic> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet indisponible")));
    script.onerror = () => reject(new Error("Impossible de charger Leaflet"));
    document.body.appendChild(script);
  });
}

function groupByPlace(events: ManifestationEvent[]): Place[] {
  const places = new Map<string, Place>();
  for (const e of events) {
    const key = `${e.lat.toFixed(3)},${e.lng.toFixed(3)}`;
    let p = places.get(key);
    if (!p) {
      p = { key, location: e.location, lat: e.lat, lng: e.lng, events: [], mentions: 0, mainType: e.type };
      places.set(key, p);
    }
    p.events.push(e);
    p.mentions += e.mentions;
  }
  for (const p of places.values()) {
    const counts: Record<string, number> = {};
    for (const e of p.events) counts[e.type] = (counts[e.type] ?? 0) + e.mentions;
    p.mainType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  return [...places.values()].sort((a, b) => b.mentions - a.mentions);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function popupHtml(p: Place) {
  const sources = [...new Map(p.events.map((e) => [e.sourceUrl, e])).values()].slice(0, 6);
  const items = sources
    .map((e) => {
      let host = e.sourceUrl;
      try {
        host = new URL(e.sourceUrl).hostname.replace(/^www\./, "");
      } catch {}
      return `<li style="margin:2px 0"><span style="color:${TYPE_STYLES[e.type].color}">●</span> ${escapeHtml(
        TYPE_STYLES[e.type].label,
      )} — <a href="${escapeHtml(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(host)}</a></li>`;
    })
    .join("");
  return `<strong>${escapeHtml(p.location)}</strong><br/>${p.events.length} événement(s), ${p.mentions} mention(s)<ul style="padding-left:0;list-style:none;margin:6px 0 0">${items}</ul>`;
}

export default function ManifestationsMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LLayerGroup | null>(null);
  const markers = useRef(new Map<string, LCircleMarker>());

  const [hours, setHours] = useState(24);
  const [data, setData] = useState<ManifestationsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_STYLES)));

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapEl.current || map.current) return;
        map.current = L.map(mapEl.current, { preferCanvas: true }).setView([46.6, 2.4], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Données : <a href="https://www.gdeltproject.org/">GDELT</a>',
        }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
        setData((d) => (d ? { ...d } : d)); // force le rendu des marqueurs si les données sont déjà là
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manifestations?hours=${hours}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hours]);

  const places = useMemo(
    () => groupByPlace((data?.events ?? []).filter((e) => activeTypes.has(e.type))),
    [data, activeTypes],
  );

  useEffect(() => {
    const L = window.L;
    if (!L || !layer.current) return;
    layer.current.clearLayers();
    markers.current.clear();
    for (const p of places) {
      const style = TYPE_STYLES[p.mainType];
      const m = L.circleMarker([p.lat, p.lng], {
        radius: Math.min(28, 5 + Math.sqrt(p.mentions) * 1.6),
        color: style.color,
        fillColor: style.color,
        fillOpacity: 0.45,
        weight: 1.5,
      })
        .bindPopup(popupHtml(p), { maxWidth: 320 })
        .bindTooltip(`${p.location} (${p.events.length})`);
      m.addTo(layer.current);
      markers.current.set(p.key, m);
    }
  }, [places]);

  const focus = (p: Place) => {
    map.current?.setView([p.lat, p.lng], 10);
    markers.current.get(p.key)?.openPopup();
  };

  const toggleType = (t: string) =>
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const total = places.reduce((n, p) => n + p.events.length, 0);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-74px)]">
      <aside className="md:w-80 w-full md:h-full max-h-[45vh] md:max-h-none overflow-y-auto border-r border-gray-200 bg-white text-gray-900 p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Manifestations en France</h1>
          <p className="text-xs text-gray-500 mt-1">
            Événements détectés dans la presse (GDELT), mis à jour toutes les 15 min.
          </p>
        </div>

        <div className="flex gap-2">
          {[6, 24, 72].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1 rounded text-sm border ${
                hours === h ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:bg-gray-100"
              }`}
            >
              {h} h
            </button>
          ))}
        </div>

        <div className="space-y-1">
          {Object.entries(TYPE_STYLES).map(([code, s]) => (
            <label key={code} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={activeTypes.has(code)} onChange={() => toggleType(code)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} />
              {s.label}
            </label>
          ))}
        </div>

        <div className="text-sm border-t pt-3">
          {error ? (
            <p className="text-red-600">Erreur : {error}</p>
          ) : loading && !data ? (
            <p className="text-gray-500">Collecte des données…</p>
          ) : (
            <>
              <p>
                <strong>{total}</strong> événement(s) dans <strong>{places.length}</strong> lieu(x)
                {loading && <span className="text-gray-400"> · actualisation…</span>}
              </p>
              {data && (
                <p className="text-xs text-gray-500">
                  Dernier lot GDELT : {new Date(data.updatedAt).toLocaleString("fr-FR")}
                  {data.filesFailed > 0 && ` · ${data.filesFailed} fichier(s) manquant(s)`}
                </p>
              )}
            </>
          )}
        </div>

        <ol className="space-y-1">
          {places.slice(0, 50).map((p) => (
            <li key={p.key}>
              <button onClick={() => focus(p)} className="w-full text-left text-sm flex items-center gap-2 hover:bg-gray-100 rounded px-1 py-0.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_STYLES[p.mainType].color }} />
                <span className="truncate flex-1">{p.location}</span>
                <span className="text-gray-500 tabular-nums">{p.events.length}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <div ref={mapEl} className="flex-1 min-h-[55vh] z-0" />
    </div>
  );
}
