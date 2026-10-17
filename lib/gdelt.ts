import { inflateRawSync } from "zlib";
import { TYPE_FAMILY } from "./protest-types";

// Collecte GDELT 2.0. Toutes les 15 minutes, GDELT publie deux fichiers utiles :
// - l'export des événements (une ligne par événement, codé CAMEO, géolocalisé) ;
// - les mentions (une ligne par article citant un événement, avec un score de
//   confiance de l'extraction). On ne garde que les manifestations (CAMEO 14x).
// GDELT_BASE_URL permet de pointer vers un miroir (ou un serveur de test).
export const GDELT_BASE = process.env.GDELT_BASE_URL ?? "http://data.gdeltproject.org/gdeltv2";

export { PROTEST_TYPES, TYPE_FAMILY, type Family } from "./protest-types";

// Précision de la position : ville (types GDELT 3 et 4) ou centre d'une région
// (types 2 et 5). Les positions « pays entier » (type 1) sont écartées.
export type GeoPrecision = "city" | "region";

export type Actor = { code: string; name: string; type: string };

export type ArticleRef = { url: string; domain: string; confidence: number | null };

export type ProtestEvent = {
  id: string;
  type: string;
  // Date de l'événement selon GDELT (AAAA-MM-JJ) et heure de sa détection.
  day: string;
  addedAt: string;
  location: string;
  country: string;
  countryName: string;
  adm1: string;
  featureId: string;
  lat: number;
  lng: number;
  precision: GeoPrecision;
  // Pour un événement de protestation, l'acteur 1 proteste, l'acteur 2 est visé.
  protester: Actor | null;
  target: Actor | null;
  // Événement tiré du chapeau de l'article (plus fiable que la fin du texte).
  isRoot: boolean;
  goldstein: number;
  tone: number;
  numMentions: number;
  numSources: number;
  numArticles: number;
  articles: ArticleRef[];
};

// Colonnes de l'export (61) et des mentions (16) de GDELT 2.0.
const EV = {
  id: 0,
  day: 1,
  a1Code: 5,
  a1Name: 6,
  a1Type: 12,
  a2Code: 15,
  a2Name: 16,
  a2Type: 22,
  isRoot: 25,
  baseCode: 27,
  rootCode: 28,
  goldstein: 30,
  numMentions: 31,
  numSources: 32,
  numArticles: 33,
  tone: 34,
  geoType: 51,
  geoName: 52,
  geoCountry: 53,
  geoAdm1: 54,
  geoLat: 56,
  geoLong: 57,
  geoFeature: 58,
  dateAdded: 59,
  sourceUrl: 60,
} as const;

const MEN = { eventId: 0, type: 3, source: 4, url: 5, confidence: 11 } as const;

// Un événement daté de plus de 3 jours avant sa détection est un rappel
// (anniversaire, procès…), pas une manifestation en cours.
const MAX_EVENT_AGE_DAYS = 3;
const MAX_ARTICLES_PER_EVENT = 15;

// Extrait le premier fichier d'une archive ZIP (les fichiers GDELT n'en contiennent qu'un).
export function unzipFirstEntry(zip: Buffer): Buffer {
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

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isoFromStamp(s: string): string {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

function actor(code: string, name: string, type: string): Actor | null {
  if (!code && !name) return null;
  return { code, name, type };
}

export function parseExport(csv: string): ProtestEvent[] {
  const events: ProtestEvent[] = [];
  for (const line of csv.split("\n")) {
    if (!line) continue;
    const c = line.split("\t");
    if (c.length < 61) continue;
    if (c[EV.rootCode] !== "14") continue;
    if (!c[EV.geoCountry]) continue;

    const geoType = c[EV.geoType];
    if (geoType === "1" || geoType === "0" || !geoType) continue;
    const lat = parseFloat(c[EV.geoLat]);
    const lng = parseFloat(c[EV.geoLong]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;

    const added = isoFromStamp(c[EV.dateAdded]);
    const d = c[EV.day];
    const day = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    if (Date.parse(added) - Date.parse(day) > (MAX_EVENT_AGE_DAYS + 1) * 86400_000) continue;

    const location = c[EV.geoName];
    const sourceUrl = c[EV.sourceUrl]?.trim() ?? "";
    const type = TYPE_FAMILY[c[EV.baseCode]] ? c[EV.baseCode] : "140";

    events.push({
      id: c[EV.id],
      type,
      day,
      addedAt: added,
      location,
      country: c[EV.geoCountry],
      // GDELT ne fournit que le code FIPS ; le nom du pays est le dernier segment du lieu.
      countryName: location.split(",").pop()?.trim() || c[EV.geoCountry],
      adm1: c[EV.geoAdm1],
      featureId: c[EV.geoFeature],
      lat,
      lng,
      precision: geoType === "3" || geoType === "4" ? "city" : "region",
      protester: actor(c[EV.a1Code], c[EV.a1Name], c[EV.a1Type]),
      target: actor(c[EV.a2Code], c[EV.a2Name], c[EV.a2Type]),
      isRoot: c[EV.isRoot] === "1",
      goldstein: parseFloat(c[EV.goldstein]) || 0,
      tone: parseFloat(c[EV.tone]) || 0,
      numMentions: parseInt(c[EV.numMentions], 10) || 0,
      numSources: parseInt(c[EV.numSources], 10) || 0,
      numArticles: parseInt(c[EV.numArticles], 10) || 0,
      articles: /^https?:\/\//.test(sourceUrl) ? [{ url: sourceUrl, domain: domainOf(sourceUrl), confidence: null }] : [],
    });
  }
  return events;
}

// Rattache aux événements les articles du fichier de mentions du même créneau,
// avec leur score de confiance (0-100). Seules les mentions web (type 1) ont une URL.
export function attachMentions(events: ProtestEvent[], csv: string): void {
  const byId = new Map(events.map((e) => [e.id, e]));
  if (byId.size === 0) return;
  for (const line of csv.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    const e = byId.get(line.slice(0, tab));
    if (!e) continue;
    const c = line.split("\t");
    if (c[MEN.type] !== "1") continue;
    const url = c[MEN.url];
    if (!/^https?:\/\//.test(url)) continue;
    const confidence = parseInt(c[MEN.confidence], 10);
    const existing = e.articles.find((a) => a.url === url);
    if (existing) {
      existing.confidence = Math.max(existing.confidence ?? 0, confidence);
    } else if (e.articles.length < MAX_ARTICLES_PER_EVENT) {
      e.articles.push({ url, domain: c[MEN.source] || domainOf(url), confidence: Number.isFinite(confidence) ? confidence : null });
    }
  }
}

// GET avec une nouvelle tentative sur erreur réseau ou 5xx.
export async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type SlotResult = { events: ProtestEvent[]; complete: boolean };

// Télécharge et analyse un créneau. `complete` est faux si GDELT n'a pas (encore)
// publié l'un des deux fichiers : le résultat ne doit alors être gardé que peu de temps.
export async function downloadSlot(stamp: string): Promise<SlotResult> {
  const exportRes = await fetchWithRetry(`${GDELT_BASE}/${stamp}.export.CSV.zip`);
  if (exportRes.status === 404) return { events: [], complete: false };
  if (!exportRes.ok) throw new Error(`export ${stamp} : HTTP ${exportRes.status}`);
  const events = parseExport(unzipFirstEntry(Buffer.from(await exportRes.arrayBuffer())).toString("utf8"));
  if (events.length === 0) return { events, complete: true };

  const mentionsRes = await fetchWithRetry(`${GDELT_BASE}/${stamp}.mentions.CSV.zip`);
  if (mentionsRes.status === 404) return { events, complete: false };
  if (!mentionsRes.ok) throw new Error(`mentions ${stamp} : HTTP ${mentionsRes.status}`);
  attachMentions(events, unzipFirstEntry(Buffer.from(await mentionsRes.arrayBuffer())).toString("utf8"));
  return { events, complete: true };
}

export function slotStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
}

export async function latestSlot(): Promise<Date> {
  const res = await fetch(`${GDELT_BASE}/lastupdate.txt`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`GDELT lastupdate.txt : HTTP ${res.status}`);
  const match = (await res.text()).match(/(\d{14})\.export\.CSV\.zip/);
  if (!match) throw new Error("GDELT lastupdate.txt : format inattendu");
  return new Date(isoFromStamp(match[1]));
}
