"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { signInToFollow, toggleFollowCountry, toggleFollowPlace } from "@/app/actions/profile";
import { countryName, getDictionary, localePath, plural, type Locale } from "@/lib/i18n";
import type { ManifestationPlace, ManifestationsResult } from "@/lib/manifestations";
import type { Profile } from "@/lib/profile";
import type { Family } from "@/lib/protest-types";
import type { Announcement } from "@/lib/announcements";
import type { PublicReport } from "@/lib/reports";
import type { SosAlert } from "@/lib/alerts";
import AdSlot from "./AdSlot";
import AnnouncementDetails, { ANNOUNCEMENT_ICON } from "./announcements/AnnouncementDetails";
import FollowButton from "./FollowButton";
import { addBaseLayer, loadLeaflet, type LatLng, type LCircleMarker, type LLayerGroup, type LMap, type LMarker, type MarkerStyle } from "./leaflet";
import { FAMILY_COLORS, FAMILY_ORDER, TYPES_BY_FAMILY, TYPE_FAMILY } from "./map-colors";
import PlaceDetails from "./PlaceDetails";
import { relativeTime } from "./relativeTime";
import { REPORT_ICONS, ReportDetails, ReportForm } from "./Reports";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/features";
import { SOS_ICONS, SosDetails, SosSheet } from "./Sos";
import { runAction } from "./staleDeployment";
import { LoadingRegion, SKELETON_WIDTHS, Skeleton } from "./Skeleton";

const REFRESH_MS = 15 * 60 * 1000;
// Les signalements des témoins changent à la minute.
const REPORTS_REFRESH_MS = 60 * 1000;
const ANNOUNCEMENTS_REFRESH_MS = 5 * 60 * 1000;
// Les alertes SOS sont urgentes : relues toutes les 20 secondes, et retirées
// de l'écran dès leur expiration (horloge locale vérifiée toutes les 5 secondes).
const ALERTS_REFRESH_MS = 20 * 1000;
const ALERTS_TICK_MS = 5 * 1000;
const WORLD = "";
const ALL_TYPES = FAMILY_ORDER.flatMap((f) => TYPES_BY_FAMILY[f]);

// Lieu après application des filtres : chiffres limités aux types actifs.
type Place = ManifestationPlace & { incidents: number; reports: number; mentions: number; family: Family };

type Country = { code: string; name: string; incidents: number; places: Place[] };

type Filters = { types: Set<string>; cityOnly: boolean; multiSource: boolean };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

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
  sos,
}: {
  locale: Locale;
  // Pays du visiteur (code FIPS), ouvert par défaut s'il a des manifestations.
  defaultCountry: string | null;
  // Profil de l'utilisateur connecté (suivis et réglages), sinon null.
  profile: Profile | null;
  // Alertes SOS : envoi réservé aux comptes vérifiés, exemples aux modérateurs ; pays ISO du visiteur.
  sos: { canSend: boolean; admin: boolean; visitorIso: string | null };
}) {
  const t = getDictionary(locale);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LLayerGroup | null>(null);
  const markers = useRef(new Map<string, { marker: LCircleMarker; place: Place }>());
  const reportLayer = useRef<LLayerGroup | null>(null);
  const draftMarker = useRef<LMarker | null>(null);

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
  // Signalements des témoins : liste active, calque affiché ou non, et formulaire en cours.
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [showReports, setShowReports] = useState(true);
  const [reporting, setReporting] = useState(false);
  const reportingRef = useRef(false);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  // Manifestations annoncées par les utilisateurs (page « Créer »), après vérification de conformité.
  const announcementLayer = useRef<LLayerGroup | null>(null);
  const sosLayer = useRef<LLayerGroup | null>(null);
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [sosOpen, setSosOpen] = useState(false);
  const [sosPicking, setSosPicking] = useState(false);
  const sosPickingRef = useRef(false);
  const [sosPoint, setSosPoint] = useState<LatLng | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [sosNotice, setSosNotice] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<string | null>(null);
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
        addBaseLayer(L, map.current, mapEl.current, '<a href="https://www.gdeltproject.org/">GDELT</a>');
        layer.current = L.layerGroup().addTo(map.current);
        announcementLayer.current = L.layerGroup().addTo(map.current);
        reportLayer.current = L.layerGroup().addTo(map.current);
        sosLayer.current = L.layerGroup().addTo(map.current);
        // Toucher la carte place le point d'une alerte SOS, ou d'un signalement
        // (arrondi comme au serveur), selon le mode en cours.
        map.current.on("click", ({ latlng }) => {
          if (sosPickingRef.current) {
            setSosPoint({ lat: latlng.lat, lng: latlng.lng });
            setSosPicking(false);
            setSosOpen(true);
            return;
          }
          if (!reportingRef.current) return;
          setDraft({ lat: Number(latlng.lat.toFixed(3)), lng: Number(latlng.lng.toFixed(3)) });
        });
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

  const loadAlerts = () =>
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { alerts: SosAlert[] } | null) => json && setAlerts(json.alerts))
      .catch(() => undefined);

  useEffect(() => {
    loadAlerts();
    const poll = setInterval(loadAlerts, ALERTS_REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), ALERTS_TICK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const liveAlerts = useMemo(() => alerts.filter((a) => Date.parse(a.expiresAt) > now), [alerts, now]);
  const liveAlertIds = liveAlerts.map((a) => a.id).join(",");

  useEffect(() => {
    sosPickingRef.current = sosPicking;
    map.current?.getContainer().classList.toggle("map-picking", sosPicking || reporting);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reporting a son propre effet
  }, [sosPicking]);

  const loadReports = () =>
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { reports: PublicReport[] } | null) => json && setReports(json.reports))
      .catch(() => undefined);

  useEffect(() => {
    loadReports();
    const timer = setInterval(loadReports, REPORTS_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ANNOUNCEMENTS_ENABLED) return;
    const load = () =>
      fetch("/api/announcements")
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { announcements: Announcement[] } | null) => json && setAnnouncements(json.announcements))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, ANNOUNCEMENTS_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

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
        .on("click", () => !reportingRef.current && selectPlace(p.key));
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

  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !reportLayer.current) return;
    reportLayer.current.clearLayers();
    if (!showReports) return;
    for (const r of reports) {
      const icon = L.divIcon({
        className: `report-pin${r.id === selectedReport ? " report-pin-selected" : ""}`,
        html: `<span>${REPORT_ICONS[r.kind]}</span>`,
        iconSize: [30, 30],
      });
      L.marker([r.lat, r.lng], { icon, zIndexOffset: 500 })
        .bindTooltip(`${t.reports.kinds[r.kind]} · ${relativeTime(locale, r.createdAt)}`)
        .on("click", () => openReport(r.id))
        .addTo(reportLayer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t et openReport ne changent qu'avec locale
  }, [reports, showReports, selectedReport, mapReady, locale]);

  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !announcementLayer.current) return;
    announcementLayer.current.clearLayers();
    if (!showAnnouncements) return;
    for (const a of announcements) {
      const icon = L.divIcon({
        className: `report-pin announcement-pin${a.id === selectedAnnouncement ? " report-pin-selected" : ""}`,
        html: `<span>${ANNOUNCEMENT_ICON}</span>`,
        iconSize: [30, 30],
      });
      const when = new Date(a.startsAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      L.marker([a.lat, a.lng], { icon, zIndexOffset: 400 })
        // Leaflet lit l'infobulle comme du HTML : le titre, saisi par un utilisateur, est échappé.
        .bindTooltip(`${escapeHtml(a.title)} · ${when}`)
        .on("click", () => !reportingRef.current && openAnnouncement(a.id))
        .addTo(announcementLayer.current);
    }
  }, [announcements, showAnnouncements, selectedAnnouncement, mapReady, locale]);

  // Alertes SOS, dessinées par-dessus tout le reste ; redessinées seulement quand la liste change.
  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !sosLayer.current) return;
    sosLayer.current.clearLayers();
    for (const a of liveAlerts) {
      const icon = L.divIcon({
        className: `sos-pin${a.demo ? " sos-demo" : ""}${a.id === selectedAlert ? " sos-pin-selected" : ""}`,
        html: `<span>${SOS_ICONS[a.kind]}</span>`,
        iconSize: [38, 38],
      });
      L.marker([a.lat, a.lng], { icon, zIndexOffset: 2000 })
        .bindTooltip(`SOS · ${t.sos.kinds[a.kind]}${a.demo ? ` (${t.sos.demo})` : ""}`)
        .on("click", () => openAlert(a.id))
        .addTo(sosLayer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveAlertIds résume liveAlerts
  }, [liveAlertIds, selectedAlert, mapReady, locale]);

  // Point en cours de placement pour un nouveau signalement.
  useEffect(() => {
    const L = window.L;
    if (!mapReady || !L || !map.current) return;
    draftMarker.current?.remove();
    draftMarker.current = null;
    if (!reporting || !draft) return;
    draftMarker.current = L.marker([draft.lat, draft.lng], {
      icon: L.divIcon({ className: "report-pin report-pin-draft", html: "<span>📍</span>", iconSize: [34, 34] }),
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map.current);
  }, [draft, reporting, mapReady]);

  useEffect(() => {
    reportingRef.current = reporting;
    map.current?.getContainer().classList.toggle("map-picking", reporting);
  }, [reporting]);

  const openReport = (id: string) => {
    setReporting(false);
    setReportNotice(null);
    setSelectedAnnouncement(null);
    setSelectedReport(id);
  };

  const openAnnouncement = (id: string) => {
    setReporting(false);
    setSelectedReport(null);
    setSelectedAnnouncement(id);
  };

  const currentAnnouncement = announcements.find((a) => a.id === selectedAnnouncement) ?? null;

  const openAlert = (id: string) => {
    setReporting(false);
    setSelectedReport(null);
    setSelectedAnnouncement(null);
    setSosNotice(null);
    setSelectedAlert(id);
    const a = alerts.find((x) => x.id === id);
    if (a) map.current?.setView([a.lat, a.lng], Math.max(map.current.getZoom(), 14));
  };

  const openSos = () => {
    setSosPoint(null);
    setSosPicking(false);
    setSosOpen(true);
  };

  const alertSent = (a: SosAlert) => {
    setAlerts((prev) => [a, ...prev.filter((x) => x.id !== a.id)]);
    setSelectedAlert(a.id);
    map.current?.setView([a.lat, a.lng], Math.max(map.current.getZoom(), 15));
  };

  const alertUpdated = (a: SosAlert | null, message: string) => {
    if (a) setAlerts((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    else {
      setAlerts((prev) => prev.filter((x) => x.id !== selectedAlert));
      setSelectedAlert(null);
    }
    setSosNotice(message);
  };

  const currentAlert = liveAlerts.find((a) => a.id === selectedAlert) ?? null;

  const signIn = () => startFollow(() => signInToFollow(window.location.pathname + window.location.search));

  const startReport = () => {
    if (!profile) return signIn();
    setReportNotice(null);
    setSelectedReport(null);
    setDraft(null);
    setLocateFailed(false);
    setReporting(true);
  };

  const stopReport = () => {
    setReporting(false);
    setDraft(null);
  };

  const locate = () => {
    if (!navigator.geolocation) return setLocateFailed(true);
    setLocating(true);
    setLocateFailed(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const point = { lat: Number(coords.latitude.toFixed(3)), lng: Number(coords.longitude.toFixed(3)) };
        setDraft(point);
        map.current?.setView([point.lat, point.lng], Math.max(map.current.getZoom(), 15));
      },
      () => {
        setLocating(false);
        setLocateFailed(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const published = (report: PublicReport) => {
    setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
    setReporting(false);
    setDraft(null);
    setShowReports(true);
    setSelectedReport(report.id);
    setReportNotice(t.reports.published);
  };

  const reportUpdated = (report: PublicReport | null, message: string) => {
    if (report) setReports((prev) => prev.map((r) => (r.id === report.id ? report : r)));
    else {
      setReports((prev) => prev.filter((r) => r.id !== selectedReport));
      setSelectedReport(null);
    }
    setReportNotice(message);
  };

  const currentReport = reports.find((r) => r.id === selectedReport) ?? null;

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
        {currentAlert ? (
          <SosDetails
            alert={currentAlert}
            locale={locale}
            now={now}
            canSend={sos.canSend}
            visitorIso={sos.visitorIso}
            onBack={() => setSelectedAlert(null)}
            onSignIn={signIn}
            onUpdated={alertUpdated}
          />
        ) : reporting ? (
          <ReportForm
            locale={locale}
            point={draft}
            locating={locating}
            locateFailed={locateFailed}
            onLocate={locate}
            onCancel={stopReport}
            onPublished={published}
          />
        ) : currentAnnouncement ? (
          <AnnouncementDetails
            announcement={currentAnnouncement}
            locale={locale}
            signedIn={!!profile}
            onBack={() => setSelectedAnnouncement(null)}
            onSignIn={signIn}
            onFlagged={(updated) =>
              setAnnouncements((prev) =>
                updated.status === "published"
                  ? prev.map((a) => (a.id === updated.id ? updated : a))
                  : prev.filter((a) => a.id !== updated.id),
              )
            }
          />
        ) : currentReport ? (
          <ReportDetails
            report={currentReport}
            locale={locale}
            signedIn={!!profile}
            notice={reportNotice}
            onBack={() => {
              setSelectedReport(null);
              setReportNotice(null);
            }}
            onSignIn={signIn}
            onUpdated={reportUpdated}
          />
        ) : selected ? (
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
            {sosNotice && (
              <p className="rounded-[3px] bg-papier-fonce px-3 py-2 text-sm" role="status">
                {sosNotice}
              </p>
            )}
            {liveAlerts.length > 0 && (
              <section aria-labelledby="sos-actives" className="rounded-[4px] border-[2px] border-[#c0262d] bg-[#c0262d]/10 p-3">
                <h2 id="sos-actives" className="flex items-center gap-2 font-bold text-[#c0262d]">
                  <span className="live-dot" aria-hidden="true" />
                  {liveAlerts.length.toLocaleString(locale)} {plural(locale, liveAlerts.length, t.sos.active)}
                </h2>
                <ol className="mt-1.5">
                  {liveAlerts.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      <button onClick={() => openAlert(a.id)} className={listButton}>
                        <span aria-hidden="true">{SOS_ICONS[a.kind]}</span>
                        <span className="flex-1 truncate font-semibold">
                          {t.sos.kinds[a.kind]}
                          {a.demo && <span className="ms-1.5 text-xs font-normal text-gris">({t.sos.demo})</span>}
                        </span>
                        <span className="text-xs text-gris">{relativeTime(locale, a.createdAt, now)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {reportNotice && (
              <p className="rounded-[3px] bg-papier-fonce px-3 py-2 text-sm" role="status">
                {reportNotice}
              </p>
            )}
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReports}
                  onChange={(e) => setShowReports(e.target.checked)}
                  className="accent-[rgb(var(--encre))]"
                />
                {t.reports.layer}
                <span className="text-gris tabular-nums">
                  ({reports.length.toLocaleString(locale)} {plural(locale, reports.length, t.reports.active)})
                </span>
              </label>
              {ANNOUNCEMENTS_ENABLED && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAnnouncements}
                      onChange={(e) => setShowAnnouncements(e.target.checked)}
                      className="accent-[rgb(var(--encre))]"
                    />
                    {ANNOUNCEMENT_ICON} {t.announcements.layer}
                    <span className="text-gris tabular-nums">
                      ({announcements.length.toLocaleString(locale)} {plural(locale, announcements.length, t.announcements.upcoming)})
                    </span>
                  </label>
                  <a
                    href={localePath(locale, "/startup/create")}
                    className="inline-block font-semibold text-bleu hover:underline underline-offset-4"
                  >
                    + {t.announcements.create}
                  </a>
                </>
              )}
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
      <div className="relative flex-1 min-h-[48vh]">
        {/* Leaflet ne gère pas le sens droite-à-gauche : la carte reste en LTR, et le bouton à droite (le zoom est à gauche). */}
        {/* z-0 contient les calques de Leaflet ; les boutons posés sur la carte restent au-dessus. */}
        <div ref={mapEl} dir="ltr" className="absolute inset-0 z-0" />
        {sosPicking ? (
          <div className="absolute inset-x-3 top-3 z-[1000] flex items-center justify-between gap-3 rounded-[4px] border-[2px] border-[#c0262d] bg-papier px-3 py-2 font-semibold shadow-[3px_3px_0_rgb(var(--encre))]">
            <span>📍 {t.sos.pickHint}</span>
            <button onClick={() => setSosPicking(false)} className="text-sm text-bleu">
              {t.sos.close}
            </button>
          </div>
        ) : (
          // Au-dessus du bandeau cookies (z 1000) : en urgence, rien ne doit masquer ce bouton.
          <button
            onClick={openSos}
            aria-label={t.sos.open}
            className="sos-button absolute bottom-8 left-3 z-[1100] flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-[#c0262d] text-xl font-black tracking-wide text-white shadow-[0_0_0_2px_rgb(var(--encre)),4px_4px_0_2px_rgb(var(--encre))]"
          >
            {t.sos.button}
          </button>
        )}
        {sosOpen && (
          <SosSheet
            locale={locale}
            canSend={sos.canSend}
            admin={sos.admin}
            visitorIso={sos.visitorIso}
            pickedPoint={sosPoint}
            mapCenter={() => map.current?.getCenter() ?? null}
            onClose={() => setSosOpen(false)}
            onPickOnMap={() => {
              setSosOpen(false);
              setSosPicking(true);
            }}
            onSignIn={signIn}
            onSent={alertSent}
            onCancelled={(id) => {
              setAlerts((prev) => prev.filter((x) => x.id !== id));
              setSelectedAlert(null);
            }}
            onDemo={(demo) => setAlerts((prev) => [...demo, ...prev])}
          />
        )}
        {!reporting && (
          <button
            onClick={startReport}
            disabled={followPending}
            className="absolute top-3 right-3 z-[1000] rounded-[3px] border-[1.5px] border-encre bg-rose px-3 py-2 font-bold text-encre shadow-[3px_3px_0_rgb(var(--encre))] disabled:opacity-60"
          >
            {profile ? `+ ${t.reports.report}` : t.reports.signInToReport}
          </button>
        )}
      </div>
    </div>
  );
}
