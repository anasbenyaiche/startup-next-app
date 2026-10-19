import { randomUUID } from "crypto";
import { isCountryCode } from "./profile";
import { storeGet, storeSet } from "./store";

// Couvre-feux par région, saisis par les modérateurs à partir des arrêtés officiels
// (préfecture, mairie, gouvernement) : chaque entrée cite sa source. Leur état
// (en vigueur, ce soir, à venir) se calcule à l'heure locale de la région.

export type Curfew = {
  id: string;
  country: string; // code FIPS, comme le reste du site
  region: string;
  area: string | null; // communes, quartiers ou périmètre concernés
  dailyStart: string; // « 21:00 », heure locale
  dailyEnd: string; // « 06:00 » ; plus tôt que le début : le couvre-feu passe minuit
  startsOn: string; // « 2026-10-20 », premier soir
  endsOn: string | null; // dernier soir, ou null jusqu'à nouvel ordre
  timezone: string; // fuseau IANA de la région
  authority: string;
  sourceUrl: string;
  notes: string | null;
  createdAt: string;
};

export type CurfewStatus =
  | { kind: "active"; until: string }
  | { kind: "tonight"; from: string }
  | { kind: "upcoming"; from: string; on: string }
  | { kind: "ended" };

const KEY = "curfews:v1";
// Les couvre-feux terminés restent affichés une semaine, puis sont effacés.
const KEEP_ENDED_DAYS = 7;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CurfewError extends Error {
  constructor(public field: string) {
    super(`Champ invalide : ${field}`);
  }
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Date (AAAA-MM-JJ) et minutes écoulées depuis minuit, dans le fuseau de la région.
export function localClock(timezone: string, now: Date): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function curfewStatus(c: Curfew, now = new Date()): CurfewStatus {
  const { date, minutes: m } = localClock(c.timezone, now);
  const start = minutes(c.dailyStart);
  const end = minutes(c.dailyEnd);
  const overnight = end <= start;
  const lastNight = c.endsOn ?? "9999-12-31";

  // Soirée en cours (ou journée entière pour un couvre-feu qui ne passe pas minuit).
  const eveningActive = date >= c.startsOn && date <= lastNight && m >= start && (overnight || m < end);
  // Petit matin : suite de la nuit commencée la veille.
  const morningActive = overnight && m < end && addDays(date, -1) >= c.startsOn && addDays(date, -1) <= lastNight;
  if (eveningActive || morningActive) return { kind: "active", until: c.dailyEnd };

  if (date < c.startsOn) return { kind: "upcoming", from: c.dailyStart, on: c.startsOn };
  if (date > lastNight) return { kind: "ended" };
  if (m < start) return { kind: "tonight", from: c.dailyStart };
  // La soirée d'aujourd'hui est passée : prochain soir demain, s'il y en a un.
  return date < lastNight ? { kind: "upcoming", from: c.dailyStart, on: addDays(date, 1) } : { kind: "ended" };
}

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim() : "").slice(0, max);

export function parseCurfew(raw: Record<string, unknown>): Omit<Curfew, "id" | "createdAt"> {
  const c = {
    country: isCountryCode(raw.country) ? raw.country : "",
    region: text(raw.region, 80),
    area: text(raw.area, 200) || null,
    dailyStart: text(raw.dailyStart, 5),
    dailyEnd: text(raw.dailyEnd, 5),
    startsOn: text(raw.startsOn, 10),
    endsOn: text(raw.endsOn, 10) || null,
    timezone: text(raw.timezone, 64),
    authority: text(raw.authority, 100),
    sourceUrl: text(raw.sourceUrl, 500),
    notes: text(raw.notes, 300) || null,
  };
  if (!c.country) throw new CurfewError("country");
  if (c.region.length < 2) throw new CurfewError("region");
  if (!TIME.test(c.dailyStart)) throw new CurfewError("dailyStart");
  if (!TIME.test(c.dailyEnd) || c.dailyEnd === c.dailyStart) throw new CurfewError("dailyEnd");
  if (!DATE.test(c.startsOn) || !Number.isFinite(Date.parse(c.startsOn))) throw new CurfewError("startsOn");
  if (c.endsOn && (!DATE.test(c.endsOn) || c.endsOn < c.startsOn)) throw new CurfewError("endsOn");
  if (!validTimezone(c.timezone)) throw new CurfewError("timezone");
  if (c.authority.length < 2) throw new CurfewError("authority");
  // La source officielle est obligatoire : c'est elle qui fait foi.
  let url: URL | null = null;
  try {
    url = new URL(c.sourceUrl);
  } catch {
    url = null;
  }
  if (!url || url.protocol !== "https:") throw new CurfewError("sourceUrl");
  return c;
}

export async function listCurfews(now = new Date()): Promise<Curfew[]> {
  const all = (await storeGet<Curfew[]>(KEY)) ?? [];
  const today = now.toISOString().slice(0, 10);
  const kept = all.filter((c) => !c.endsOn || addDays(c.endsOn, KEEP_ENDED_DAYS) >= today);
  if (kept.length !== all.length) await storeSet(KEY, kept);
  return kept;
}

export async function addCurfew(raw: Record<string, unknown>): Promise<Curfew> {
  const curfew: Curfew = { ...parseCurfew(raw), id: randomUUID(), createdAt: new Date().toISOString() };
  await storeSet(KEY, [...(await listCurfews()), curfew]);
  return curfew;
}

export async function deleteCurfew(id: string): Promise<void> {
  await storeSet(
    KEY,
    (await listCurfews()).filter((c) => c.id !== id),
  );
}
