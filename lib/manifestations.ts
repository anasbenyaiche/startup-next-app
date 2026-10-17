import { inflateRawSync } from "zlib";

// GDELT 2.0 publie toutes les 15 minutes un export CSV (zippé) de tous les
// événements détectés dans la presse mondiale. Le code CAMEO racine "14"
// correspond aux manifestations / protestations.
const GDELT_BASE = "http://data.gdeltproject.org/gdeltv2";
const LAST_UPDATE_URL = `${GDELT_BASE}/lastupdate.txt`;
const SLOT_MS = 15 * 60 * 1000;
const FETCH_CONCURRENCY = 8;

// Codes pays FIPS utilisés par GDELT : métropole + outre-mer.
const FRANCE_FIPS = new Set(["FR", "RE", "GP", "MQ", "FG", "MF", "NC", "FP", "TB", "RN", "SB", "WF"]);

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
  geoAdm1: 54,
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
  region: string;
  lat: number;
  lng: number;
  mentions: number;
  articles: number;
  tone: number;
  dateAdded: string;
  sourceUrl: string;
};

export type ManifestationsResult = {
  updatedAt: string;
  hours: number;
  filesFetched: number;
  filesFailed: number;
  events: ManifestationEvent[];
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
    if (!FRANCE_FIPS.has(c[COL.geoCountry])) continue;
    // Type 1 = pays entier (centroïde de la France) : position inexploitable sur une carte.
    if (c[COL.geoType] === "1") continue;

    const lat = parseFloat(c[COL.geoLat]);
    const lng = parseFloat(c[COL.geoLong]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const type = PROTEST_TYPES[c[COL.eventBaseCode]] ? c[COL.eventBaseCode] : "140";
    const actors = [c[COL.actor1Name], c[COL.actor2Name]].filter(Boolean);
    const added = c[COL.dateAdded];

    events.push({
      id: c[COL.id],
      type,
      typeLabel: PROTEST_TYPES[type],
      actors,
      location: c[COL.geoName],
      region: c[COL.geoAdm1],
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

async function fetchSlot(stamp: string): Promise<ManifestationEvent[]> {
  // Les fichiers d'un créneau passé ne changent plus : cache long.
  const res = await fetch(`${GDELT_BASE}/${stamp}.export.CSV.zip`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  return parseExport(unzipFirstEntry(zip).toString("utf8"));
}

export async function getManifestations(hours: number): Promise<ManifestationsResult> {
  const latest = await latestSlot();
  const count = Math.max(1, Math.round((hours * 3600 * 1000) / SLOT_MS));
  const stamps = Array.from({ length: count }, (_, i) => slotStamp(new Date(latest.getTime() - i * SLOT_MS)));

  const byId = new Map<string, ManifestationEvent>();
  let failed = 0;
  for (let i = 0; i < stamps.length; i += FETCH_CONCURRENCY) {
    const batch = await Promise.allSettled(stamps.slice(i, i + FETCH_CONCURRENCY).map(fetchSlot));
    for (const r of batch) {
      if (r.status === "rejected") {
        failed++;
        continue;
      }
      for (const e of r.value) byId.set(e.id, e);
    }
  }

  const events = [...byId.values()].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  return {
    updatedAt: latest.toISOString(),
    hours,
    filesFetched: stamps.length - failed,
    filesFailed: failed,
    events,
  };
}
