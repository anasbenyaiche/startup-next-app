"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ManifestationPlace, ManifestationsResult } from "@/lib/manifestations";

const LEAFLET_VERSION = "1.9.4";
const REFRESH_MS = 15 * 60 * 1000;
const WORLD = "";

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  "141": { label: "Manifestation / rassemblement", color: "#2563eb" },
  "143": { label: "Grève / boycott", color: "#d97706" },
  "144": { label: "Blocage / occupation", color: "#7c3aed" },
  "145": { label: "Émeute / violences", color: "#dc2626" },
  "142": { label: "Grève de la faim", color: "#0d9488" },
  "140": { label: "Autre protestation", color: "#6b7280" },
};
const TYPE_ORDER = ["141", "143", "144", "145", "142", "140"];

// Lieu après application du filtre par type.
type Place = ManifestationPlace & { count: number; mentions: number; mainType: string };

type Country = { code: string; name: string; count: number; places: Place[] };

// Leaflet est chargé depuis le CDN : on ne type que ce qui est utilisé ici.
interface LLayer {
  addTo(target: LMap | LLayerGroup): this;
}
interface LMap {
  setView(center: [number, number], zoom: number): LMap;
  fitBounds(bounds: [number, number][], options?: { maxZoom?: number; padding?: [number, number] }): LMap;
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
  map(el: HTMLElement, options?: { preferCanvas?: boolean; worldCopyJump?: boolean }): LMap;
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

function applyTypeFilter(places: ManifestationPlace[], active: Set<string>): Place[] {
  const result: Place[] = [];
  for (const p of places) {
    let count = 0;
    let mentions = 0;
    let mainType = "";
    let mainMentions = -1;
    for (const [type, t] of Object.entries(p.byType)) {
      if (!active.has(type)) continue;
      count += t.count;
      mentions += t.mentions;
      if (t.mentions > mainMentions) {
        mainType = type;
        mainMentions = t.mentions;
      }
    }
    if (count > 0) result.push({ ...p, count, mentions, mainType });
  }
  return result.sort((a, b) => b.mentions - a.mentions);
}

function groupByCountry(places: Place[]): Country[] {
  const countries = new Map<string, Country>();
  for (const p of places) {
    let c = countries.get(p.country);
    if (!c) {
      c = { code: p.country, name: p.countryName, count: 0, places: [] };
      countries.set(p.country, c);
    }
    c.count += p.count;
    c.places.push(p);
  }
  return [...countries.values()].sort((a, b) => b.count - a.count);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function popupHtml(p: Place, active: Set<string>) {
  const items = p.sources
    .filter((s) => active.has(s.type))
    .map((s) => {
      let host = s.url;
      try {
        host = new URL(s.url).hostname.replace(/^www\./, "");
      } catch {}
      return `<li style="margin:2px 0"><span style="color:${TYPE_STYLES[s.type].color}">●</span> ${escapeHtml(
        TYPE_STYLES[s.type].label,
      )} — <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(host)}</a></li>`;
    })
    .join("");
  return `<strong>${escapeHtml(p.location)}</strong><br/>${p.count} événement(s), ${p.mentions} mention(s)<br/><span style="color:#6b7280">Dernier : ${new Date(
    p.latestAt,
  ).toLocaleString("fr-FR")}</span><ul style="padding-left:0;list-style:none;margin:6px 0 0">${items}</ul>`;
}

export default function ManifestationsMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LLayerGroup | null>(null);
  const markers = useRef(new Map<string, LCircleMarker>());

  const [mapReady, setMapReady] = useState(false);
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<ManifestationsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(TYPE_ORDER));
  const [country, setCountry] = useState(WORLD);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapEl.current || map.current) return;
        map.current = L.map(mapEl.current, { preferCanvas: true, worldCopyJump: true }).setView([25, 10], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Données : <a href="https://www.gdeltproject.org/">GDELT</a>',
        }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
        setMapReady(true);
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

  const allPlaces = useMemo(() => applyTypeFilter(data?.places ?? [], activeTypes), [data, activeTypes]);
  const countries = useMemo(() => groupByCountry(allPlaces), [allPlaces]);
  const selected = countries.find((c) => c.code === country);
  const places = useMemo(
    () => (country === WORLD ? allPlaces : (countries.find((c) => c.code === country)?.places ?? [])),
    [allPlaces, countries, country],
  );

  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !layer.current) return;
    layer.current.clearLayers();
    markers.current.clear();
    // Les plus gros lieux sont dessinés en dernier pour rester au-dessus.
    for (let i = places.length - 1; i >= 0; i--) {
      const p = places[i];
      const style = TYPE_STYLES[p.mainType];
      const m = L.circleMarker([p.lat, p.lng], {
        radius: Math.min(26, 3 + Math.sqrt(p.mentions) * 1.4),
        color: style.color,
        fillColor: style.color,
        fillOpacity: 0.45,
        weight: 1,
      })
        .bindPopup(popupHtml(p, activeTypes), { maxWidth: 320 })
        .bindTooltip(`${p.location} (${p.count})`);
      m.addTo(layer.current);
      markers.current.set(p.key, m);
    }
  }, [places, activeTypes, mapReady]);

  const selectCountry = (code: string) => {
    setCountry(code);
    const c = countries.find((x) => x.code === code);
    if (!map.current) return;
    if (!c) map.current.setView([25, 10], 2);
    else map.current.fitBounds(c.places.map((p) => [p.lat, p.lng]), { maxZoom: 8, padding: [30, 30] });
  };

  const focusPlace = (p: Place) => {
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

  const total = places.reduce((n, p) => n + p.count, 0);
  const listButton = "w-full text-left text-sm flex items-center gap-2 hover:bg-gray-100 rounded px-1 py-0.5";

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-74px)]">
      <aside className="md:w-80 w-full md:h-full max-h-[45vh] md:max-h-none overflow-y-auto border-r border-gray-200 bg-white text-gray-900 p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">
            Manifestations {country === WORLD ? "dans le monde" : `· ${selected?.name ?? country}`}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Événements détectés dans la presse mondiale (GDELT), mis à jour toutes les 15 min.
          </p>
        </div>

        <select
          value={country}
          onChange={(e) => selectCountry(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        >
          <option value={WORLD}>🌍 Monde entier</option>
          {country !== WORLD && !selected && <option value={country}>{country} (aucun événement)</option>}
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>

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
          {TYPE_ORDER.map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={activeTypes.has(code)} onChange={() => toggleType(code)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: TYPE_STYLES[code].color }} />
              {TYPE_STYLES[code].label}
            </label>
          ))}
        </div>

        <div className="text-sm border-t pt-3">
          {error ? (
            <p className="text-red-600">Erreur : {error}</p>
          ) : loading && !data ? (
            <p className="text-gray-500">Collecte des données… (jusqu&apos;à une minute en 72 h)</p>
          ) : (
            <>
              <p>
                <strong>{total.toLocaleString("fr-FR")}</strong> événement(s) dans{" "}
                <strong>{places.length.toLocaleString("fr-FR")}</strong> lieu(x)
                {country === WORLD && (
                  <>
                    {" "}
                    · <strong>{countries.length}</strong> pays
                  </>
                )}
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

        {country === WORLD ? (
          <ol className="space-y-1">
            <li className="text-xs uppercase tracking-wide text-gray-500">Pays les plus actifs</li>
            {countries.slice(0, 50).map((c) => (
              <li key={c.code}>
                <button onClick={() => selectCountry(c.code)} className={listButton}>
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="text-gray-500 tabular-nums">{c.count}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="space-y-1">
            <li className="text-xs uppercase tracking-wide text-gray-500">Lieux les plus actifs</li>
            {places.slice(0, 50).map((p) => (
              <li key={p.key}>
                <button onClick={() => focusPlace(p)} className={listButton}>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: TYPE_STYLES[p.mainType].color }}
                  />
                  <span className="truncate flex-1">{p.location}</span>
                  <span className="text-gray-500 tabular-nums">{p.count}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>
      <div ref={mapEl} className="flex-1 min-h-[55vh] z-0" />
    </div>
  );
}
