import { inflateRawSync } from "zlib";
import { cacheGet, cacheSet } from "./cache";

// GDELT 2.0 publie toutes les 15 minutes un export CSV (zippé) de tous les
// événements détectés dans la presse mondiale. Le code CAMEO racine "14"
// correspond aux manifestations / protestations.
const GDELT_BASE = "http://data.gdeltproject.org/gdeltv2";
const LAST_UPDATE_URL = `${GDELT_BASE}/lastupdate.txt`;
const SLOT_MS = 15 * 60 * 1000;
const FETCH_CONCURRENCY = 8;
const MAX_SOURCES_PER_PLACE = 6;

export const PROTEST_TYPES: Record<string, string> = {
  "140": "Manifestation (autre)",
  "141": "Manifestation / rassemblement",
  "142": "Grève de la faim",
  "143": "Grève / boycott",
  "144": "Blocage / occupation",
  "145": "Émeute / manifestation violente",
};

// Index des colonnes de l'export GDELT 2.0 (61 colonnes).
const COL = {
  id: 0,
  day: 1,
  actor1Name: 6,
  actor2Name: 16,
  eventCode: 26,
  eventBaseCode: 27,
  eventRootCode: 28,
  numMentions: 31,
  numSources: 32,
  numArticles: 33,
  avgTone: 34,
  geoType: 51,
  geoName: 52,
  geoCountry: 53,
  geoLat: 56,
  geoLong: 57,
  dateAdded: 59,
  sourceUrl: 60,
} as const;

export type ManifestationEvent = {
  id: string;
  type: string;
  typeLabel: string;
  actors: string[];
  location: string;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  mentions: number;
  articles: number;
  tone: number;
  dateAdded: string;
  sourceUrl: string;
};

// Les événements sont agrégés par lieu côté serveur : en mondial, il y en a
// des dizaines de milliers sur 72 h, trop pour être envoyés un par un.
export type ManifestationPlace = {
  key: string;
  location: string;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  byType: Record<string, { count: number; mentions: number }>;
  latestAt: string;
  sources: { url: string; type: string }[];
};

export type ManifestationsResult = {
  updatedAt: string;
  hours: number;
  filesFetched: number;
  filesFailed: number;
  totalEvents: number;
  places: ManifestationPlace[];
};

// Extrait le premier fichier d'une archive ZIP (les exports GDELT n'en contiennent qu'un).
export function unzipFirstEntry(zip: Buffer): Buffer {
  // Recherche de l'"End of Central Directory" en partant de la fin.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP invalide : EOCD introuvable");

  const cd = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(cd) !== 0x02014b50) throw new Error("ZIP invalide : répertoire central");
  const method = zip.readUInt16LE(cd + 10);
  const compressedSize = zip.readUInt32LE(cd + 20);
  const localOffset = zip.readUInt32LE(cd + 42);

  if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP invalide : en-tête local");
  const nameLen = zip.readUInt16LE(localOffset + 26);
  const extraLen = zip.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLen + extraLen;
  const data = zip.subarray(start, start + compressedSize);

  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error(`ZIP : méthode de compression ${method} non supportée`);
}

export function parseExport(csv: string): ManifestationEvent[] {
  const events: ManifestationEvent[] = [];
  for (const line of csv.split("\n")) {
    if (!line) continue;
    const c = line.split("\t");
    if (c.length < 61) continue;
    if (c[COL.eventRootCode] !== "14") continue;
    if (!c[COL.geoCountry]) continue;
    // Type 1 = pays entier (centroïde du pays) : position inexploitable sur une carte.
    if (c[COL.geoType] === "1") continue;

    const lat = parseFloat(c[COL.geoLat]);
    const lng = parseFloat(c[COL.geoLong]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const type = PROTEST_TYPES[c[COL.eventBaseCode]] ? c[COL.eventBaseCode] : "140";
    const actors = [c[COL.actor1Name], c[COL.actor2Name]].filter(Boolean);
    const added = c[COL.dateAdded];
    const location = c[COL.geoName];

    events.push({
      id: c[COL.id],
      type,
      typeLabel: PROTEST_TYPES[type],
      actors,
      location,
      country: c[COL.geoCountry],
      // GDELT ne fournit que le code FIPS ; le nom du pays est le dernier segment du lieu.
      countryName: location.split(",").pop()?.trim() || c[COL.geoCountry],
      lat,
      lng,
      mentions: parseInt(c[COL.numMentions], 10) || 0,
      articles: parseInt(c[COL.numArticles], 10) || 0,
      tone: parseFloat(c[COL.avgTone]) || 0,
      dateAdded: `${added.slice(0, 4)}-${added.slice(4, 6)}-${added.slice(6, 8)}T${added.slice(8, 10)}:${added.slice(10, 12)}:${added.slice(12, 14)}Z`,
      sourceUrl: c[COL.sourceUrl]?.trim() ?? "",
    });
  }
  return events;
}

function slotStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
}

async function latestSlot(): Promise<Date> {
  const res = await fetch(LAST_UPDATE_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`GDELT lastupdate.txt : HTTP ${res.status}`);
  const text = await res.text();
  const match = text.match(/(\d{14})\.export\.CSV\.zip/);
  if (!match) throw new Error("GDELT lastupdate.txt : format inattendu");
  const s = match[1];
  return new Date(
    Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)),
  );
}

// Un fichier de 15 min ne change plus une fois publié : on garde ses
// manifestations un peu plus longtemps que la plus longue période affichée (72 h).
const SLOT_TTL = 4 * 24 * 3600;
// Le résultat agrégé vaut jusqu'au prochain fichier GDELT.
const AGGREGATE_TTL = 15 * 60;

async function fetchSlot(stamp: string): Promise<ManifestationEvent[]> {
  const key = `gdelt:slot:${stamp}`;
  const cached = await cacheGet<ManifestationEvent[]>(key);
  if (cached) return cached;
  // Pas de cache Next : les archives peuvent dépasser sa limite de 2 Mo par entrée.
  const res = await fetch(`${GDELT_BASE}/${stamp}.export.CSV.zip`, { cache: "no-store" });
  // GDELT saute parfois un créneau : on le note vide une heure (il peut arriver en retard).
  if (res.status === 404) {
    await cacheSet(key, [], 3600);
    return [];
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  const events = parseExport(unzipFirstEntry(zip).toString("utf8"));
  await cacheSet(key, events, SLOT_TTL);
  return events;
}

export function groupByPlace(events: Iterable<ManifestationEvent>): ManifestationPlace[] {
  const places = new Map<string, ManifestationPlace>();
  for (const e of events) {
    const key = `${e.lat.toFixed(3)},${e.lng.toFixed(3)}`;
    let p = places.get(key);
    if (!p) {
      p = {
        key,
        location: e.location,
        country: e.country,
        countryName: e.countryName,
        lat: e.lat,
        lng: e.lng,
        byType: {},
        latestAt: e.dateAdded,
        sources: [],
      };
      places.set(key, p);
    }
    const t = (p.byType[e.type] ??= { count: 0, mentions: 0 });
    t.count++;
    t.mentions += e.mentions;
    if (e.dateAdded > p.latestAt) p.latestAt = e.dateAdded;
    if (e.sourceUrl && p.sources.length < MAX_SOURCES_PER_PLACE && !p.sources.some((s) => s.url === e.sourceUrl)) {
      p.sources.push({ url: e.sourceUrl, type: e.type });
    }
  }
  return [...places.values()];
}

export async function getManifestations(hours: number): Promise<ManifestationsResult> {
  const latest = await latestSlot();
  const aggregateKey = `gdelt:agg:${hours}:${slotStamp(latest)}`;
  const cached = await cacheGet<ManifestationsResult>(aggregateKey);
  if (cached) return cached;

  const count = Math.max(1, Math.round((hours * 3600 * 1000) / SLOT_MS));
  const stamps = Array.from({ length: count }, (_, i) => slotStamp(new Date(latest.getTime() - i * SLOT_MS)));

  // Les créneaux sont parcourus du plus récent au plus ancien : les sources
  // gardées pour chaque lieu sont donc les plus récentes.
  const byId = new Map<string, ManifestationEvent>();
  let failed = 0;
  for (let i = 0; i < stamps.length; i += FETCH_CONCURRENCY) {
    const batch = await Promise.allSettled(stamps.slice(i, i + FETCH_CONCURRENCY).map(fetchSlot));
    for (const r of batch) {
      if (r.status === "rejected") {
        failed++;
        continue;
      }
      for (const e of r.value) if (!byId.has(e.id)) byId.set(e.id, e);
    }
  }

  const result: ManifestationsResult = {
    updatedAt: latest.toISOString(),
    hours,
    filesFetched: stamps.length - failed,
    filesFailed: failed,
    totalEvents: byId.size,
    places: groupByPlace(byId.values()),
  };
  // Un résultat incomplet (fichiers en échec) n'est pas partagé : la requête suivante réessaiera.
  if (failed === 0) await cacheSet(aggregateKey, result, AGGREGATE_TTL);
  return result;
}
