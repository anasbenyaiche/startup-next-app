import "server-only";
import { cacheGet, cacheHashGet, cacheHashSet, cacheSet } from "@/lib/core/cache";
import { downloadSlot, latestSlot, slotStamp, type GeoPrecision, type ProtestEvent } from "@/lib/news/gdelt";

export { TYPE_FAMILY, type Family, type GeoPrecision } from "@/lib/news/gdelt";

const SLOT_MS = 15 * 60 * 1000;
const FETCH_CONCURRENCY = 12;
// Préfixe de version : à changer quand la forme des données en cache change.
const CACHE_VERSION = "v2";
// Un créneau complet ne change plus : on le garde un peu plus que la plus longue
// période affichée (72 h). Un créneau incomplet est réessayé au bout d'une heure.
const SLOT_TTL = 4 * 24 * 3600;
const INCOMPLETE_SLOT_TTL = 3600;
// Le résultat agrégé et le détail des lieux valent jusqu'au prochain fichier GDELT.
const AGGREGATE_TTL = 15 * 60;

export type TypeStats = { reports: number; incidents: number; mentions: number };

// Un lieu tel qu'envoyé à la carte : juste de quoi filtrer, colorer et dimensionner.
export type ManifestationPlace = {
  key: string;
  location: string;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  precision: GeoPrecision;
  byType: Record<string, TypeStats>;
  // Nombre de médias distincts (domaines) ayant couvert le lieu, et score de fiabilité.
  domains: number;
  reliability: number;
  latestAt: string;
};

export type ManifestationsResult = {
  updatedAt: string;
  hours: number;
  filesFetched: number;
  filesFailed: number;
  totalReports: number;
  // Chargement progressif : une requête lit les fichiers GDELT pendant un temps
  // limité, du plus récent au plus ancien. `partial` indique qu'il en reste.
  slotsLoaded: number;
  slotsTotal: number;
  partial: boolean;
  places: ManifestationPlace[];
};

export type ActorStat = { kind: "type" | "name"; value: string; count: number };

export type PlaceDetails = {
  key: string;
  location: string;
  country: string;
  countryName: string;
  adm1: string;
  lat: number;
  lng: number;
  precision: GeoPrecision;
  hours: number;
  updatedAt: string;
  incidents: number;
  reports: number;
  mentions: number;
  firstSeen: string;
  lastSeen: string;
  reliability: Reliability;
  types: { type: string; reports: number; incidents: number }[];
  timeline: { start: string; bucketMinutes: number; counts: number[] };
  protesters: ActorStat[];
  targets: ActorStat[];
  tone: number;
  goldstein: number;
  articles: { url: string; domain: string; confidence: number | null; addedAt: string; type: string }[];
};

export type Reliability = {
  score: number;
  level: "high" | "medium" | "low";
  domains: number;
  avgConfidence: number | null;
  rootShare: number;
};

// --- Clés de cache --------------------------------------------------------

const slotKey = (stamp: string) => `gdelt:${CACHE_VERSION}:slot:${stamp}`;
const aggregateKey = (hours: number, stamp: string) => `gdelt:${CACHE_VERSION}:agg:${hours}:${stamp}`;
// Dernier agrégat complet, quel que soit le créneau : les pages indexables le lisent
// sans jamais lancer de calcul pendant qu'un moteur de recherche attend.
const lastAggregateKey = (hours: number) => `gdelt:${CACHE_VERSION}:agg:${hours}:last`;
const LAST_AGGREGATE_TTL = 6 * 3600;
const placesKey = (hours: number, stamp: string) => `gdelt:${CACHE_VERSION}:places:${hours}:${stamp}`;

async function getSlot(stamp: string): Promise<ProtestEvent[]> {
  const cached = await cacheGet<ProtestEvent[]>(slotKey(stamp));
  if (cached) return cached;
  const { events, complete } = await downloadSlot(stamp);
  await cacheSet(slotKey(stamp), events, complete ? SLOT_TTL : INCOMPLETE_SLOT_TTL);
  return events;
}

// --- Analyse -------------------------------------------------------------

// Les lieux sont regroupés par identifiant géographique GDELT (ville ou région),
// plus fiable qu'un arrondi des coordonnées ; repli sur les coordonnées sinon.
function placeKeyOf(e: ProtestEvent): string {
  return e.featureId ? `${e.country}:${e.featureId}` : `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
}

// Fiabilité d'un lieu (0-100), à partir de trois signaux indépendants :
// - la diversité des médias (domaines distincts), le signal le plus fort ;
// - la confiance moyenne de GDELT dans l'extraction de l'événement depuis chaque article ;
// - la part d'événements tirés du début des articles (où se trouve l'information principale).
function reliabilityOf(events: ProtestEvent[]): Reliability {
  const domains = new Set<string>();
  let confSum = 0;
  let confCount = 0;
  let roots = 0;
  for (const e of events) {
    if (e.isRoot) roots++;
    for (const a of e.articles) {
      if (a.domain) domains.add(a.domain);
      if (a.confidence !== null) {
        confSum += a.confidence;
        confCount++;
      }
    }
  }
  // Repli sur le nombre de sources compté par GDELT si les mentions manquent.
  const domainCount = domains.size || events.reduce((n, e) => Math.max(n, e.numSources), 0);
  const avgConfidence = confCount ? confSum / confCount : null;
  const rootShare = events.length ? roots / events.length : 0;
  const diversity = Math.min(1, Math.log(1 + domainCount) / Math.log(1 + 5));
  const score = Math.round(100 * (0.45 * diversity + 0.35 * ((avgConfidence ?? 50) / 100) + 0.2 * rootShare));
  return {
    score,
    level: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
    domains: domainCount,
    avgConfidence: avgConfidence === null ? null : Math.round(avgConfidence),
    rootShare: Math.round(rootShare * 100) / 100,
  };
}

// Une « manifestation » est estimée comme un couple (jour, type) en un même lieu :
// GDELT produit souvent plusieurs événements pour un même rassemblement
// (un par article et par formulation des acteurs).
function incidentKey(e: ProtestEvent) {
  return `${e.day}|${e.type}`;
}

function summarizePlace(key: string, events: ProtestEvent[]): ManifestationPlace {
  const first = events[0];
  const byType: Record<string, TypeStats> = {};
  const incidents = new Map<string, Set<string>>();
  let latestAt = first.addedAt;
  for (const e of events) {
    const t = (byType[e.type] ??= { reports: 0, incidents: 0, mentions: 0 });
    t.reports++;
    t.mentions += e.numMentions;
    const set = incidents.get(e.type) ?? new Set();
    set.add(incidentKey(e));
    incidents.set(e.type, set);
    if (e.addedAt > latestAt) latestAt = e.addedAt;
  }
  for (const [type, set] of incidents) byType[type].incidents = set.size;
  const reliability = reliabilityOf(events);
  return {
    key,
    location: first.location,
    country: first.country,
    countryName: first.countryName,
    lat: first.lat,
    lng: first.lng,
    // Si au moins un événement est localisé à la ville, le lieu l'est.
    precision: events.some((e) => e.precision === "city") ? "city" : "region",
    byType,
    domains: reliability.domains,
    reliability: reliability.score,
    latestAt,
  };
}

// Noms génériques que GDELT donne aux acteurs d'une catégorie (POLICE pour COP…) :
// ils répètent la catégorie, on ne garde que les noms propres (personnes, organisations, pays).
const GENERIC_ACTOR_NAMES = new Set(
  (
    "POLICE,GOVERNMENT,STUDENT,STUDENTS,WORKER,WORKERS,FARMER,FARMERS,PROTESTER,PROTESTERS,ACTIVIST,ACTIVISTS," +
    "COMPANY,BUSINESS,MILITARY,SOLDIER,ARMY,CITIZEN,CITIZENS,CIVILIAN,CIVILIANS,RESIDENT,RESIDENTS,OPPOSITION," +
    "LEGISLATOR,LAWMAKER,PARLIAMENT,MEDIA,JOURNALIST,JOURNALISTS,UNION,UNIONS,LABOR UNION,TRADE UNION,TEACHER,TEACHERS," +
    "DOCTOR,DOCTORS,NURSE,NURSES,REBEL,REBELS,REFUGEE,REFUGEES,MIGRANT,MIGRANTS,COURT,JUDGE,AUTHORITIES,OFFICIAL," +
    "OFFICIALS,SECURITY FORCES,EMPLOYEE,EMPLOYEES,COMMUNITY,MILITANT,MILITANTS,COP,ENVIRONMENTALIST"
  ).split(","),
);

function topActors(actors: (ProtestEvent["protester"])[], limit = 5): ActorStat[] {
  const types = new Map<string, number>();
  const names = new Map<string, number>();
  for (const a of actors) {
    if (!a) continue;
    if (a.type) types.set(a.type, (types.get(a.type) ?? 0) + 1);
    if (a.name && !GENERIC_ACTOR_NAMES.has(a.name)) names.set(a.name, (names.get(a.name) ?? 0) + 1);
  }
  const sorted = (m: Map<string, number>, kind: ActorStat["kind"]) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ kind, value, count }));
  return [...sorted(types, "type"), ...sorted(names, "name")];
}

export function analyzePlace(key: string, events: ProtestEvent[], hours: number, updatedAt: string): PlaceDetails {
  const summary = summarizePlace(key, events);
  const end = Date.parse(updatedAt) + SLOT_MS;
  const bucketMinutes = hours <= 6 ? 30 : hours <= 24 ? 60 : 180;
  const bucketMs = bucketMinutes * 60_000;
  const bucketCount = Math.ceil((hours * 3600_000) / bucketMs);
  const start = end - bucketCount * bucketMs;
  const counts = new Array<number>(bucketCount).fill(0);

  const articles = new Map<string, PlaceDetails["articles"][number]>();
  let toneSum = 0;
  let goldsteinSum = 0;
  let firstSeen = events[0].addedAt;
  for (const e of events) {
    const i = Math.floor((Date.parse(e.addedAt) - start) / bucketMs);
    if (i >= 0 && i < bucketCount) counts[i]++;
    toneSum += e.tone;
    goldsteinSum += e.goldstein;
    if (e.addedAt < firstSeen) firstSeen = e.addedAt;
    for (const a of e.articles) {
      const existing = articles.get(a.url);
      if (!existing) articles.set(a.url, { ...a, addedAt: e.addedAt, type: e.type });
      else if ((a.confidence ?? 0) > (existing.confidence ?? 0)) existing.confidence = a.confidence;
    }
  }

  const types = Object.entries(summary.byType)
    .map(([type, s]) => ({ type, reports: s.reports, incidents: s.incidents }))
    .sort((a, b) => b.reports - a.reports);

  return {
    key,
    location: summary.location,
    country: summary.country,
    countryName: summary.countryName,
    adm1: events[0].adm1,
    lat: summary.lat,
    lng: summary.lng,
    precision: summary.precision,
    hours,
    updatedAt,
    incidents: types.reduce((n, t) => n + t.incidents, 0),
    reports: events.length,
    mentions: events.reduce((n, e) => n + e.numMentions, 0),
    firstSeen,
    lastSeen: summary.latestAt,
    reliability: reliabilityOf(events),
    types,
    timeline: { start: new Date(start).toISOString(), bucketMinutes, counts },
    protesters: topActors(events.map((e) => e.protester)),
    targets: topActors(events.map((e) => e.target)),
    tone: Math.round((toneSum / events.length) * 10) / 10,
    goldstein: Math.round((goldsteinSum / events.length) * 10) / 10,
    // Les articles les plus sûrs d'abord, puis les plus récents.
    articles: [...articles.values()]
      .sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1) || b.addedAt.localeCompare(a.addedAt))
      .slice(0, 25),
  };
}

// --- Chargement d'une période --------------------------------------------

// Durée de lecture par requête : sous la limite des fonctions Vercel (60 s), pour
// répondre à temps avec ce qui est déjà lu plutôt qu'échouer. Chaque fichier lu est
// mis en cache, et la requête suivante reprend là où celle-ci s'est arrêtée.
export const DEFAULT_BUDGET_MS = Number(process.env.GDELT_BUDGET_MS) || 40_000;

async function build(hours: number, latest: Date, budgetMs = Infinity): Promise<ManifestationsResult> {
  const deadline = Date.now() + budgetMs;
  const count = Math.max(1, Math.round((hours * 3600_000) / SLOT_MS));
  const stamps = Array.from({ length: count }, (_, i) => slotStamp(new Date(latest.getTime() - i * SLOT_MS)));

  const byId = new Map<string, ProtestEvent>();
  let failed = 0;
  let loaded = 0;
  for (let i = 0; i < stamps.length; i += FETCH_CONCURRENCY) {
    if (Date.now() > deadline) break;
    loaded += stamps.slice(i, i + FETCH_CONCURRENCY).length;
    const batch = await Promise.allSettled(stamps.slice(i, i + FETCH_CONCURRENCY).map(getSlot));
    for (const r of batch) {
      if (r.status === "rejected") {
        failed++;
        continue;
      }
      for (const e of r.value) if (!byId.has(e.id)) byId.set(e.id, e);
    }
  }

  const byPlace = new Map<string, ProtestEvent[]>();
  for (const e of byId.values()) {
    const key = placeKeyOf(e);
    const list = byPlace.get(key);
    if (list) list.push(e);
    else byPlace.set(key, [e]);
  }

  const stamp = slotStamp(latest);
  const result: ManifestationsResult = {
    updatedAt: latest.toISOString(),
    hours,
    filesFetched: loaded - failed,
    filesFailed: failed,
    totalReports: byId.size,
    slotsLoaded: loaded,
    slotsTotal: stamps.length,
    partial: loaded < stamps.length,
    places: [...byPlace.entries()].map(([key, events]) => summarizePlace(key, events)),
  };
  // Le détail des lieux est toujours gardé (il sert au clic) ; un agrégat incomplet
  // n'est pas partagé, pour que la requête suivante réessaie les fichiers manquants.
  await cacheHashSet(placesKey(hours, stamp), Object.fromEntries(byPlace), AGGREGATE_TTL);
  if (failed === 0 && loaded === stamps.length) {
    await cacheSet(aggregateKey(hours, stamp), result, AGGREGATE_TTL);
    await cacheSet(lastAggregateKey(hours), result, LAST_AGGREGATE_TTL);
  }
  return result;
}

export async function getManifestations(hours: number, budgetMs = DEFAULT_BUDGET_MS): Promise<ManifestationsResult> {
  const latest = await latestSlot();
  const cached = await cacheGet<ManifestationsResult>(aggregateKey(hours, slotStamp(latest)));
  return cached ?? build(hours, latest, budgetMs);
}

export async function getPlaceDetails(hours: number, key: string): Promise<PlaceDetails | null> {
  const latest = await latestSlot();
  const stamp = slotStamp(latest);
  let events = await cacheHashGet<ProtestEvent[]>(placesKey(hours, stamp), key);
  // Détail expiré ou jamais calculé sur cette instance : on reconstruit la période,
  // sauf si l'agrégat est à jour (la clé demandée n'existe simplement pas).
  if (!events && !(await cacheGet<ManifestationsResult>(aggregateKey(hours, stamp)))) {
    await build(hours, latest, DEFAULT_BUDGET_MS);
    events = await cacheHashGet<ProtestEvent[]>(placesKey(hours, stamp), key);
  }
  return events?.length ? analyzePlace(key, events, hours, latest.toISOString()) : null;
}

// Agrégat déjà calculé (jusqu'à quelques heures), sans appel réseau ni calcul.
export async function getCachedManifestations(hours: number): Promise<ManifestationsResult | null> {
  return cacheGet<ManifestationsResult>(lastAggregateKey(hours));
}
