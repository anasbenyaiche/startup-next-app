"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ManifestationPlace, ManifestationsResult } from "@/lib/manifestations";

const LEAFLET_VERSION = "1.9.4";
const REFRESH_MS = 15 * 60 * 1000;
const WORLD = "";

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  // Encres riso ; le rose est réservé à la marque et au direct.
  "141": { label: "Manifestation, rassemblement", color: "#2f55d4" },
  "143": { label: "Grève, boycott", color: "#e09a00" },
  "144": { label: "Blocage, occupation", color: "#7a3fd1" },
  "145": { label: "Émeute, violences", color: "#e5322d" },
  "142": { label: "Grève de la faim", color: "#0e9f8e" },
  "140": { label: "Autre protestation", color: "#8a8fa0" },
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
  // Pays demandé dans l'URL (?pays=FR), appliqué dès que carte et données sont prêtes.
  const requestedCountry = useRef<string | null>(null);

  useEffect(() => {
    requestedCountry.current = new URLSearchParams(window.location.search).get("pays")?.toUpperCase() || null;
    if (requestedCountry.current) setCountry(requestedCountry.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapEl.current || map.current) return;
        map.current = L.map(mapEl.current, { preferCanvas: true, worldCopyJump: true }).setView([25, 10], 2);
        // Fond de carte gris clair (CARTO Positron) : les points de couleur ressortent.
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>, données <a href="https://www.gdeltproject.org/">GDELT</a>',
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
        fillOpacity: 0.55,
        weight: 1.5,
      })
        .bindPopup(popupHtml(p, activeTypes), { maxWidth: 320 })
        .bindTooltip(`${p.location} (${p.count})`);
      m.addTo(layer.current);
      markers.current.set(p.key, m);
    }
  }, [places, activeTypes, mapReady]);

  const selectCountry = (code: string) => {
    setCountry(code);
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("pays", code);
    else url.searchParams.delete("pays");
    window.history.replaceState(null, "", url);
    const c = countries.find((x) => x.code === code);
    if (!map.current) return;
    if (!c) map.current.setView([25, 10], 2);
    else map.current.fitBounds(c.places.map((p) => [p.lat, p.lng]), { maxZoom: 8, padding: [30, 30] });
  };

  useEffect(() => {
    const code = requestedCountry.current;
    if (!code || !mapReady || countries.length === 0) return;
    requestedCountry.current = null;
    selectCountry(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne s'applique qu'une fois, au chargement
  }, [mapReady, countries]);

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
  const listButton =
    "w-full text-left flex items-center gap-2.5 rounded-[3px] px-1.5 py-1 hover:bg-papier-fonce hover:text-bleu";

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-3.5rem)]">
      <aside className="md:w-[22rem] w-full md:h-full max-h-[48vh] md:max-h-none overflow-y-auto border-b-[1.5px] md:border-b-0 md:border-r-[1.5px] border-encre bg-papier p-5 space-y-5">
        <div>
          <h1 className="display text-[2.6rem]">
            {country === WORLD ? "Le monde" : (selected?.name ?? country)}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-gris">
            <span className="live-dot" aria-hidden="true" />
            {error
              ? "Mise à jour interrompue"
              : data
                ? `En direct, mis à jour à ${new Date(data.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "Connexion au flux de presse…"}
          </p>
        </div>

        <label className="block">
          <span className="sr-only">Pays</span>
          <select
            value={country}
            onChange={(e) => selectCountry(e.target.value)}
            className="w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-2.5 py-2 font-semibold"
          >
            <option value={WORLD}>Tous les pays</option>
            {country !== WORLD && !selected && <option value={country}>{country} (aucun événement)</option>}
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm text-gris mb-1.5">Période</legend>
          <div className="grid grid-cols-3 rounded-[3px] border-[1.5px] border-encre overflow-hidden">
            {[6, 24, 72].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                aria-pressed={hours === h}
                className={`py-1.5 font-semibold [&:not(:first-child)]:border-l-[1.5px] border-encre ${
                  hours === h ? "bg-encre text-papier" : "hover:bg-papier-fonce"
                }`}
              >
                {h} h
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm text-gris mb-1.5">Types</legend>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_ORDER.map((code) => {
              const on = activeTypes.has(code);
              return (
                <button
                  key={code}
                  onClick={() => toggleType(code)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-0.5 text-sm ${
                    on ? "border-encre" : "border-encre/25 text-gris line-through decoration-1"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: on ? TYPE_STYLES[code].color : "transparent", boxShadow: `inset 0 0 0 1.5px ${TYPE_STYLES[code].color}` }}
                  />
                  {TYPE_STYLES[code].label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="border-t-[1.5px] border-encre pt-4">
          {error ? (
            <p className="text-[#c0262d]">
              Le flux de presse ne répond pas ({error}). La carte réessaiera dans 15 minutes.
            </p>
          ) : loading && !data ? (
            <p className="text-gris">Lecture des articles de presse… jusqu&apos;à une minute pour 72 h.</p>
          ) : (
            <p className="text-lg leading-snug">
              <strong className="tabular-nums">{total.toLocaleString("fr-FR")}</strong> manifestations dans{" "}
              <strong className="tabular-nums">{places.length.toLocaleString("fr-FR")}</strong> lieux
              {country === WORLD && (
                <>
                  , <strong className="tabular-nums">{countries.length}</strong> pays
                </>
              )}
              {loading && <span className="text-gris text-sm"> (actualisation)</span>}
            </p>
          )}
          {data && data.filesFailed > 0 && (
            <p className="text-sm text-gris mt-1">{data.filesFailed} relevé(s) de 15 min manquant(s) sur la période.</p>
          )}
        </div>

        {country === WORLD ? (
          <section>
            <h2 className="font-bold mb-1.5">Pays les plus actifs</h2>
            <ol>
              {countries.slice(0, 50).map((c) => (
                <li key={c.code}>
                  <button onClick={() => selectCountry(c.code)} className={listButton}>
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="text-gris tabular-nums">{c.count}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <section>
            <div className="flex items-baseline justify-between mb-1.5">
              <h2 className="font-bold">Lieux les plus actifs</h2>
              <button onClick={() => selectCountry(WORLD)} className="text-sm text-bleu hover:underline underline-offset-4">
                Voir le monde
              </button>
            </div>
            <ol>
              {places.slice(0, 50).map((p) => (
                <li key={p.key}>
                  <button onClick={() => focusPlace(p)} className={listButton}>
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: TYPE_STYLES[p.mainType].color }}
                    />
                    <span className="truncate flex-1">{p.location}</span>
                    <span className="text-gris tabular-nums">{p.count}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>
      <div ref={mapEl} className="flex-1 min-h-[52vh] z-0" />
    </div>
  );
}
