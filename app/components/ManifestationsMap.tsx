"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { signInToFollow, toggleFollowCountry, toggleFollowPlace } from "@/app/actions/profile";
import { countryName, getDictionary, plural, type Locale } from "@/lib/i18n";
import type { ManifestationPlace, ManifestationsResult } from "@/lib/manifestations";
import type { Profile } from "@/lib/profile";
import type { Family } from "@/lib/protest-types";
import AdSlot from "./AdSlot";
import FollowButton from "./FollowButton";
import { FAMILY_COLORS, FAMILY_ORDER, TYPES_BY_FAMILY, TYPE_FAMILY } from "./map-colors";
import PlaceDetails from "./PlaceDetails";
import { runAction } from "./staleDeployment";
import { LoadingRegion, SKELETON_WIDTHS, Skeleton } from "./Skeleton";

const LEAFLET_VERSION = "1.9.4";
// Clé CARTO Basemaps (gratuite, obligatoire depuis septembre 2026). Sans elle, le fond
// de carte CARTO affiche « API KEY REQUIRED » : on se rabat alors sur OpenStreetMap.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
const REFRESH_MS = 15 * 60 * 1000;
const WORLD = "";
const ALL_TYPES = FAMILY_ORDER.flatMap((f) => TYPES_BY_FAMILY[f]);

// Lieu après application des filtres : chiffres limités aux types actifs.
type Place = ManifestationPlace & { incidents: number; reports: number; mentions: number; family: Family };

type Country = { code: string; name: string; incidents: number; places: Place[] };

type Filters = { types: Set<string>; cityOnly: boolean; multiSource: boolean };

// Leaflet est chargé depuis le CDN : on ne type que ce qui est utilisé ici.
interface LLayer {
  addTo(target: LMap | LLayerGroup): this;
}
interface LMap {
  setView(center: [number, number], zoom: number): LMap;
  fitBounds(bounds: [number, number][], options?: { maxZoom?: number; padding?: [number, number] }): LMap;
  getZoom(): number;
  remove(): void;
}
interface LLayerGroup extends LLayer {
  clearLayers(): void;
}
type MarkerStyle = {
  radius: number;
  color: string;
  fillColor: string;
  fillOpacity: number;
  weight: number;
  dashArray?: string;
};
interface LCircleMarker extends LLayer {
  bindTooltip(text: string): LCircleMarker;
  on(event: "click", handler: () => void): LCircleMarker;
  setStyle(style: Partial<MarkerStyle>): LCircleMarker;
  bringToFront(): void;
}
interface LStatic {
  map(el: HTMLElement, options?: { preferCanvas?: boolean; worldCopyJump?: boolean }): LMap;
  tileLayer(url: string, options: { maxZoom: number; attribution: string }): LLayer;
  layerGroup(): LLayerGroup;
  circleMarker(latlng: [number, number], options: MarkerStyle): LCircleMarker;
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

function applyFilters(places: ManifestationPlace[], f: Filters): Place[] {
  const result: Place[] = [];
  for (const p of places) {
    if (f.cityOnly && p.precision !== "city") continue;
    if (f.multiSource && p.domains < 2) continue;
    let incidents = 0;
    let reports = 0;
    let mentions = 0;
    const byFamily: Partial<Record<Family, number>> = {};
    for (const [type, s] of Object.entries(p.byType)) {
      if (!f.types.has(type)) continue;
      incidents += s.incidents;
      reports += s.reports;
      mentions += s.mentions;
      const fam = TYPE_FAMILY[type];
      byFamily[fam] = (byFamily[fam] ?? 0) + s.mentions + s.reports;
    }
    if (incidents === 0) continue;
    const family = Object.entries(byFamily).sort((a, b) => b[1] - a[1])[0][0] as Family;
    result.push({ ...p, incidents, reports, mentions, family });
  }
  return result.sort((a, b) => b.mentions - a.mentions);
}

function groupByCountry(places: Place[], locale: Locale): Country[] {
  const countries = new Map<string, Country>();
  for (const p of places) {
    let c = countries.get(p.country);
    if (!c) {
      c = { code: p.country, name: countryName(locale, p.country, p.countryName), incidents: 0, places: [] };
      countries.set(p.country, c);
    }
    c.incidents += p.incidents;
    c.places.push(p);
  }
  return [...countries.values()].sort((a, b) => b.incidents - a.incidents);
}

// Style d'un point : la couleur dit la famille, la taille la couverture médiatique.
// Une position approximative (centre de région) est un cercle creux en pointillés,
// pour ne pas laisser croire à une localisation précise.
function markerStyle(p: Place, selected: boolean): MarkerStyle {
  const color = FAMILY_COLORS[p.family];
  const approx = p.precision === "region";
  return {
    radius: Math.min(26, 4 + Math.sqrt(p.mentions) * 1.3),
    color: selected ? "rgb(30,33,64)" : approx ? color : "rgba(30,33,64,0.65)",
    fillColor: color,
    fillOpacity: approx ? 0.15 : 0.7,
    weight: selected ? 3 : approx ? 2 : 1,
    dashArray: approx ? "4 3" : undefined,
  };
}

function updateUrl(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState(null, "", url);
}

export default function ManifestationsMap({
  locale,
  defaultCountry,
  profile,
}: {
  locale: Locale;
  // Pays du visiteur (code FIPS), ouvert par défaut s'il a des manifestations.
  defaultCountry: string | null;
  // Profil de l'utilisateur connecté (suivis et réglages), sinon null.
  profile: Profile | null;
}) {
  const t = getDictionary(locale);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LLayerGroup | null>(null);
  const markers = useRef(new Map<string, { marker: LCircleMarker; place: Place }>());

  const [mapReady, setMapReady] = useState(false);
  const [hours, setHours] = useState(profile?.defaultHours ?? 24);
  const [data, setData] = useState<ManifestationsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    types: new Set(ALL_TYPES),
    cityOnly: profile?.cityOnly ?? false,
    multiSource: profile?.multiSource ?? false,
  });
  const [followedCountries, setFollowedCountries] = useState(profile?.followedCountries ?? []);
  const [followedPlaces, setFollowedPlaces] = useState(profile?.followedPlaces ?? []);
  const [followsConsentAt, setFollowsConsentAt] = useState(profile?.followsConsentAt ?? null);
  const [followPending, startFollow] = useTransition();
  const [country, setCountry] = useState(WORLD);
  const [selected, setSelected] = useState<string | null>(null);
  // Pays à ouvrir dès que carte et données sont prêtes : celui de l'URL (?pays=FR),
  // sinon celui du visiteur. Ce dernier n'est appliqué que s'il a des manifestations.
  const requestedCountry = useRef<{ code: string; explicit: boolean } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("pays")?.toUpperCase();
    if (fromUrl) {
      requestedCountry.current = { code: fromUrl, explicit: true };
      setCountry(fromUrl);
    } else if (profile?.defaultCountry) {
      // Choisi dans le profil : affiché même sans manifestation en cours.
      requestedCountry.current = { code: profile.defaultCountry, explicit: true };
      setCountry(profile.defaultCountry);
    } else if (defaultCountry) {
      requestedCountry.current = { code: defaultCountry, explicit: false };
    }
    const place = params.get("lieu");
    if (place) setSelected(place);
    const h = Number(params.get("periode"));
    if ([6, 24, 72].includes(h)) setHours(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture unique de l'URL et du profil à l'ouverture
  }, [defaultCountry]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapEl.current || map.current) return;
        map.current = L.map(mapEl.current, { preferCanvas: true, worldCopyJump: true }).setView([25, 10], 2);
        // Fond de carte : CARTO Positron (gris clair) si une clé est fournie, sinon les tuiles
        // OpenStreetMap, sans clé, passées en gris par CSS pour que les points de couleur ressortent.
        const gdelt = '<a href="https://www.gdeltproject.org/">GDELT</a>';
        const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
        if (CARTO_KEY) {
          L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, {
            maxZoom: 18,
            attribution: `${osm}, &copy; <a href="https://carto.com/attributions">CARTO</a>, ${gdelt}`,
          }).addTo(map.current);
        } else {
          mapEl.current.classList.add("tuiles-grises");
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: `${osm}, ${gdelt}`,
          }).addTo(map.current);
        }
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
    // Changer de période vide la carte : garder l'ancienne période affichée
    // pendant le calcul laisserait croire qu'elle correspond au nouveau choix.
    setData(null);
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const load = async () => {
      clearTimeout(retry);
      setLoading(true);
      try {
        const res = await fetch(`/api/manifestations?hours=${hours}`);
        // Une fonction coupée par l'hébergeur renvoie une page HTML, pas du JSON.
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (cancelled) return;
        failures = 0;
        setData(json);
        setError(null);
        // Période encore incomplète : on redemande tout de suite, le serveur reprend
        // là où il s'est arrêté (les fichiers déjà lus sont en cache).
        if (json.partial) retry = setTimeout(load, 1000);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur de chargement");
        // Quelques nouvelles tentatives rapprochées avant d'attendre l'actualisation suivante.
        if (++failures <= 3) retry = setTimeout(load, 3000 * failures);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearInterval(timer);
    };
  }, [hours]);

  const allPlaces = useMemo(() => applyFilters(data?.places ?? [], filters), [data, filters]);
  const countries = useMemo(() => groupByCountry(allPlaces, locale), [allPlaces, locale]);
  const current = countries.find((c) => c.code === country);
  const places = useMemo(
    () => (country === WORLD ? allPlaces : (countries.find((c) => c.code === country)?.places ?? [])),
    [allPlaces, countries, country],
  );

  const selectPlace = (key: string | null) => {
    setSelected(key);
    updateUrl({ lieu: key });
  };

  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !layer.current) return;
    layer.current.clearLayers();
    markers.current.clear();
    // Les plus gros lieux sont dessinés en dernier pour rester au-dessus.
    for (let i = places.length - 1; i >= 0; i--) {
      const p = places[i];
      const label = `${p.location} (${p.incidents})${p.precision === "region" ? `, ${t.map.approx}` : ""}`;
      const m = L.circleMarker([p.lat, p.lng], markerStyle(p, false))
        .bindTooltip(label)
        .on("click", () => selectPlace(p.key));
      m.addTo(layer.current);
      markers.current.set(p.key, { marker: m, place: p });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t et selectPlace ne changent qu'avec locale
  }, [places, mapReady, locale]);

  // Mise en évidence du lieu ouvert, sans redessiner toute la carte.
  useEffect(() => {
    const entry = selected ? markers.current.get(selected) : undefined;
    if (!entry) return;
    entry.marker.setStyle(markerStyle(entry.place, true));
    entry.marker.bringToFront();
    return () => {
      entry.marker.setStyle(markerStyle(entry.place, false));
    };
  }, [selected, places]);

  const selectCountry = (code: string) => {
    setCountry(code);
    updateUrl({ pays: code || null });
    const c = countries.find((x) => x.code === code);
    if (!map.current) return;
    if (!c) map.current.setView([25, 10], 2);
    else map.current.fitBounds(c.places.map((p) => [p.lat, p.lng]), { maxZoom: 8, padding: [30, 30] });
  };

  useEffect(() => {
    const request = requestedCountry.current;
    if (!request || !mapReady || countries.length === 0) return;
    requestedCountry.current = null;
    if (request.explicit || countries.some((c) => c.code === request.code)) selectCountry(request.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne s'applique qu'une fois, au chargement
  }, [mapReady, countries]);

  const openPlace = (p: Place) => {
    map.current?.setView([p.lat, p.lng], Math.max(map.current.getZoom(), p.precision === "city" ? 9 : 6));
    selectPlace(p.key);
  };

  const changeHours = (h: number) => {
    setHours(h);
    updateUrl({ periode: h === 24 ? null : String(h) });
  };

  const toggleType = (type: string) =>
    setFilters((prev) => {
      const types = new Set(prev.types);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      return { ...prev, types };
    });

  // Suivre demande d'être connecté : sinon, connexion puis retour sur la même vue.
  // Le premier suivi demande un consentement explicite (les suivis peuvent révéler
  // des opinions politiques) ; le serveur refuse d'enregistrer un suivi sans lui.
  const follow = (action: (consent: boolean) => Promise<Profile>, adding: boolean) => {
    if (!profile) {
      startFollow(() => signInToFollow(window.location.pathname + window.location.search));
      return;
    }
    let consent = false;
    if (adding && !followsConsentAt) {
      if (!window.confirm(t.legal.followConsent)) return;
      consent = true;
    }
    startFollow(async () => {
      const updated = await runAction(() => action(consent));
      if (!updated) return;
      setFollowedCountries(updated.followedCountries);
      setFollowedPlaces(updated.followedPlaces);
      setFollowsConsentAt(updated.followsConsentAt);
    });
  };

  const followedCountryRows = countries.filter((c) => followedCountries.includes(c.code));

  const total = places.reduce((n, p) => n + p.incidents, 0);
  const listButton =
    "w-full text-start flex items-center gap-2.5 rounded-[3px] px-1.5 py-1 hover:bg-papier-fonce hover:text-bleu";
  const dot = (p: Place) => (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${p.precision === "region" ? "border-[1.5px] border-dashed" : ""}`}
      style={p.precision === "region" ? { borderColor: FAMILY_COLORS[p.family] } : { background: FAMILY_COLORS[p.family] }}
    />
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-3.5rem)]">
      <aside className="md:w-[23rem] w-full md:h-full max-h-[52vh] md:max-h-none overflow-y-auto border-b-[1.5px] md:border-b-0 md:border-e-[1.5px] border-encre bg-papier p-5 space-y-5">
        {selected ? (
          <PlaceDetails
            placeKey={selected}
            hours={hours}
            locale={locale}
            onBack={() => selectPlace(null)}
            renderFollow={(details) => (
              <FollowButton
                following={followedPlaces.some((p) => p.key === selected)}
                pending={followPending}
                signedIn={!!profile}
                labels={{ on: t.follow.followingPlace, off: t.follow.followPlace, signIn: t.follow.signInToFollow }}
                onClick={() =>
                  follow(
                    (consent) =>
                      toggleFollowPlace({ key: selected, label: details.location, country: details.country }, consent),
                    !followedPlaces.some((p) => p.key === selected),
                  )
                }
              />
            )}
          />
        ) : (
          <>
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="display text-[2.6rem]">{country === WORLD ? t.map.world : (current?.name ?? country)}</h1>
                {country !== WORLD && (
                  <FollowButton
                    following={followedCountries.includes(country)}
                    pending={followPending}
                    signedIn={!!profile}
                    labels={{ on: t.follow.followingCountry, off: t.follow.followCountry, signIn: t.follow.signInToFollow }}
                    onClick={() =>
                      follow((consent) => toggleFollowCountry(country, consent), !followedCountries.includes(country))
                    }
                  />
                )}
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm text-gris">
                <span className="live-dot" aria-hidden="true" />
                {error
                  ? t.map.interrupted
                  : data
                    ? t.map.live(new Date(data.updatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }))
                    : t.map.connecting}
              </p>
            </div>

            <label className="block">
              <span className="sr-only">{t.map.country}</span>
              <select
                value={country}
                onChange={(e) => selectCountry(e.target.value)}
                className="w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-2.5 py-2 font-semibold"
              >
                <option value={WORLD}>{t.map.allCountries}</option>
                {country !== WORLD && !current && (
                  <option value={country}>
                    {country} ({t.map.noEvents})
                  </option>
                )}
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.incidents.toLocaleString(locale)})
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm text-gris mb-1.5">{t.map.period}</legend>
              <div className="grid grid-cols-3 rounded-[3px] border-[1.5px] border-encre overflow-hidden">
                {[6, 24, 72].map((h) => (
                  <button
                    key={h}
                    onClick={() => changeHours(h)}
                    aria-pressed={hours === h}
                    className={`py-1.5 font-semibold [&:not(:first-child)]:border-s-[1.5px] border-encre ${
                      hours === h ? "bg-encre text-papier" : "hover:bg-papier-fonce"
                    }`}
                  >
                    {h} h
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2.5">
              <legend className="text-sm text-gris mb-1.5">{t.map.types}</legend>
              {FAMILY_ORDER.map((fam) => (
                <div key={fam}>
                  <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: FAMILY_COLORS[fam] }} />
                    {t.families[fam]}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TYPES_BY_FAMILY[fam].map((code) => {
                      const on = filters.types.has(code);
                      return (
                        <button
                          key={code}
                          onClick={() => toggleType(code)}
                          aria-pressed={on}
                          className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-sm ${
                            on ? "border-encre" : "border-encre/25 text-gris line-through decoration-1"
                          }`}
                        >
                          {t.types[code]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </fieldset>

            <fieldset className="space-y-1.5 text-sm">
              <legend className="text-sm text-gris mb-1.5">{t.filters.reliability}</legend>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.cityOnly}
                  onChange={(e) => setFilters((f) => ({ ...f, cityOnly: e.target.checked }))}
                  className="accent-[rgb(var(--encre))]"
                />
                {t.filters.cityOnly}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.multiSource}
                  onChange={(e) => setFilters((f) => ({ ...f, multiSource: e.target.checked }))}
                  className="accent-[rgb(var(--encre))]"
                />
                {t.filters.multiSource}
              </label>
              <p className="flex items-center gap-2 text-gris pt-1">
                <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-dashed border-gris" aria-hidden="true" />
                <span className="inline-block first-letter:uppercase">{t.map.approx}</span>
              </p>
            </fieldset>

            <div className="border-t-[1.5px] border-encre pt-4">
              {error ? (
                <p className="text-[#c0262d]">{t.map.feedDown(error)}</p>
              ) : loading && !data ? (
                <LoadingRegion label={t.map.reading}>
                  <Skeleton className="h-6 w-4/5" />
                  <p className="mt-2 text-sm text-gris">{t.map.reading}</p>
                </LoadingRegion>
              ) : (
                <p className="text-lg leading-snug">
                  <strong className="tabular-nums">{total.toLocaleString(locale)}</strong>{" "}
                  {plural(locale, total, t.map.protests)} {t.map.in}{" "}
                  <strong className="tabular-nums">{places.length.toLocaleString(locale)}</strong>{" "}
                  {plural(locale, places.length, t.map.places)}
                  {country === WORLD && (
                    <>
                      , <strong className="tabular-nums">{countries.length.toLocaleString(locale)}</strong>{" "}
                      {plural(locale, countries.length, t.map.countries)}
                    </>
                  )}
                  {loading && <span className="text-gris text-sm"> {t.map.refreshing}</span>}
                </p>
              )}
              {data?.partial && (
                <p className="text-sm text-gris mt-1" role="status">
                  {t.map.partial(Math.round((data.slotsLoaded / data.slotsTotal) * 100))}
                </p>
              )}
              {data && data.filesFailed > 0 && <p className="text-sm text-gris mt-1">{t.map.missingSlots(data.filesFailed)}</p>}
            </div>

            <AdSlot locale={locale} country={country === WORLD ? null : country} />

            {country === WORLD && followedCountryRows.length > 0 && (
              <section>
                <h2 className="font-bold mb-1.5">{t.follow.yourFollows}</h2>
                <ol>
                  {followedCountryRows.map((c) => (
                    <li key={c.code}>
                      <button onClick={() => selectCountry(c.code)} className={listButton}>
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="text-gris tabular-nums">{c.incidents.toLocaleString(locale)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {!data && !error ? (
              // Même rythme que la liste : une ligne par lieu ou par pays.
              <section aria-hidden="true">
                <Skeleton className="h-5 w-40 mb-2.5" />
                {SKELETON_WIDTHS.map((w, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-1.5 py-1 h-8">
                    <span className="flex-1">
                      <Skeleton className="h-4" style={{ width: w }} />
                    </span>
                    <Skeleton className="h-4 w-6" />
                  </div>
                ))}
              </section>
            ) : country === WORLD ? (
              <section>
                <h2 className="font-bold mb-1.5">{t.map.topCountries}</h2>
                <ol>
                  {countries.slice(0, 50).map((c) => (
                    <li key={c.code}>
                      <button onClick={() => selectCountry(c.code)} className={listButton}>
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="text-gris tabular-nums">{c.incidents.toLocaleString(locale)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <section>
                <div className="flex items-baseline justify-between mb-1.5">
                  <h2 className="font-bold">{t.map.topPlaces}</h2>
                  <button onClick={() => selectCountry(WORLD)} className="text-sm text-bleu hover:underline underline-offset-4">
                    {t.map.seeWorld}
                  </button>
                </div>
                <ol>
                  {places.slice(0, 50).map((p) => (
                    <li key={p.key}>
                      <button onClick={() => openPlace(p)} className={listButton}>
                        {dot(p)}
                        <span className="truncate flex-1">{p.location}</span>
                        <span className="text-gris tabular-nums">{p.incidents.toLocaleString(locale)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </aside>
      {/* Leaflet ne gère pas le sens droite-à-gauche : la carte reste en LTR. */}
      <div ref={mapEl} dir="ltr" className="flex-1 min-h-[48vh] z-0" />
    </div>
  );
}
