import { createHmac, randomUUID } from "crypto";
import { readyRedis } from "./cache";

// Signalements publiés par les utilisateurs, au point près, comme un témoin sur place.
// Ils sont éphémères : chacun disparaît après une durée qui dépend de son type.
// Le compte de l'auteur n'est jamais publié ; on ne garde qu'une empreinte (HMAC)
// pour limiter le nombre de signalements et empêcher de voter deux fois, et elle
// disparaît avec le signalement.

export const REPORT_KINDS = ["march", "gathering", "teargas", "danger", "blocked"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const CROWD_SIZES = ["small", "medium", "large"] as const;
export type CrowdSize = (typeof CROWD_SIZES)[number];

// Durée de vie, en minutes : un nuage de gaz ou un danger passe plus vite qu'un cortège.
const LIFETIME_MIN: Record<ReportKind, number> = {
  march: 180,
  gathering: 180,
  teargas: 60,
  danger: 60,
  blocked: 120,
};
// Chaque confirmation prolonge le signalement, jusqu'à deux fois sa durée de départ.
const CONFIRM_EXTENSION_MIN = 30;
// Au-delà de ce nombre de signalements d'abus, le signalement est retiré.
export const FLAG_LIMIT = 3;
const RATE_LIMIT_PER_HOUR = 10;
const MAX_LISTED = 1000;
// Trois décimales, soit environ 100 m : assez pour la rue, sans pointer une personne.
const COORD_DECIMALS = 3;

// Plateformes acceptées pour un lien vidéo : celles que le carrousel sait afficher ou ouvrir.
const VIDEO_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "fb.watch",
  "twitch.tv",
];

export type PublicReport = {
  id: string;
  kind: ReportKind;
  lat: number;
  lng: number;
  crowd: CrowdSize | null;
  videoUrl: string | null;
  createdAt: string;
  expiresAt: string;
  confirms: number;
  flags: number;
};

type StoredReport = PublicReport & { author: string };

export type Vote = "confirm" | "flag";

export class ReportError extends Error {
  constructor(public code: "invalid" | "invalidVideo" | "rateLimited" | "notFound" | "own") {
    super(code);
  }
}

const KEY = {
  index: "reports:v1:index",
  item: (id: string) => `reports:v1:item:${id}`,
  votes: (id: string) => `reports:v1:votes:${id}`,
  rate: (author: string) => `reports:v1:rate:${author}`,
};

// Sans Redis (développement local), tout reste en mémoire du processus.
const memory = {
  items: new Map<string, StoredReport>(),
  votes: new Map<string, Map<string, Vote>>(),
  rate: new Map<string, { count: number; resetAt: number }>(),
};

export function authorHash(userId: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "cortege")
    .update(`report:${userId}`)
    .digest("hex")
    .slice(0, 24);
}

const round = (v: number) => Number(v.toFixed(COORD_DECIMALS));

export function normalizeVideoUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 500) throw new ReportError("invalidVideo");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ReportError("invalidVideo");
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|vm|vt|mobile)\./, "");
  if (url.protocol !== "https:" || !VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new ReportError("invalidVideo");
  }
  url.hash = "";
  return url.toString();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- l'empreinte de l'auteur ne sort jamais du serveur
const toPublic = ({ author, ...r }: StoredReport): PublicReport => r;

async function rateLimit(author: string) {
  const redis = await readyRedis();
  if (redis) {
    const count = await redis.incr(KEY.rate(author));
    if (count === 1) await redis.expire(KEY.rate(author), 3600);
    if (count > RATE_LIMIT_PER_HOUR) throw new ReportError("rateLimited");
    return;
  }
  const now = Date.now();
  const entry = memory.rate.get(author);
  const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + 3600_000 };
  current.count++;
  memory.rate.set(author, current);
  if (current.count > RATE_LIMIT_PER_HOUR) throw new ReportError("rateLimited");
}

async function save(report: StoredReport) {
  const redis = await readyRedis();
  const expiresAt = Date.parse(report.expiresAt);
  if (redis) {
    const ttl = Math.max(1000, expiresAt - Date.now());
    await redis
      .multi()
      .set(KEY.item(report.id), JSON.stringify(report), "PX", ttl)
      .zadd(KEY.index, expiresAt, report.id)
      .pexpire(KEY.votes(report.id), ttl)
      .exec();
    return;
  }
  memory.items.set(report.id, report);
}

async function load(id: string): Promise<StoredReport | null> {
  const redis = await readyRedis();
  const report = redis
    ? ((raw) => (raw ? (JSON.parse(raw) as StoredReport) : null))(await redis.get(KEY.item(id)))
    : (memory.items.get(id) ?? null);
  return report && Date.parse(report.expiresAt) > Date.now() ? report : null;
}

async function remove(id: string) {
  const redis = await readyRedis();
  if (redis) {
    await redis.multi().del(KEY.item(id), KEY.votes(id)).zrem(KEY.index, id).exec();
    return;
  }
  memory.items.delete(id);
  memory.votes.delete(id);
}

// Retrait par un modérateur.
export async function removeReport(id: string): Promise<void> {
  await remove(id);
}

export async function createReport(
  userId: string,
  input: {
    kind: unknown;
    lat: unknown;
    lng: unknown;
    crowd?: unknown;
    videoUrl?: unknown;
  },
): Promise<PublicReport> {
  const { kind, lat, lng, crowd } = input;
  if (!REPORT_KINDS.includes(kind as ReportKind)) throw new ReportError("invalid");
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ReportError("invalid");
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new ReportError("invalid");
  // La taille de la foule n'a de sens que pour un cortège ou un rassemblement.
  const withCrowd = kind === "march" || kind === "gathering";
  if (crowd != null && !CROWD_SIZES.includes(crowd as CrowdSize)) throw new ReportError("invalid");
  const videoUrl = normalizeVideoUrl(input.videoUrl);

  const author = authorHash(userId);
  await rateLimit(author);
  const now = Date.now();
  const report: StoredReport = {
    id: randomUUID(),
    kind: kind as ReportKind,
    lat: round(lat),
    lng: round(lng),
    crowd: withCrowd ? ((crowd as CrowdSize | undefined) ?? null) : null,
    videoUrl,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LIFETIME_MIN[kind as ReportKind] * 60_000).toISOString(),
    confirms: 0,
    flags: 0,
    author,
  };
  await save(report);
  return toPublic(report);
}

// Un vote par compte et par signalement. Les totaux sont recomptés depuis la liste
// des votes, ce qui reste juste même si deux votes arrivent en même temps.
export async function voteReport(userId: string, id: string, vote: Vote): Promise<PublicReport | null> {
  if (vote !== "confirm" && vote !== "flag") throw new ReportError("invalid");
  const report = await load(id);
  if (!report) throw new ReportError("notFound");
  const voter = authorHash(userId);
  if (report.author === voter) throw new ReportError("own");

  let votes: Vote[];
  const redis = await readyRedis();
  if (redis) {
    await redis.hsetnx(KEY.votes(id), voter, vote);
    votes = (await redis.hvals(KEY.votes(id))) as Vote[];
  } else {
    const map = memory.votes.get(id) ?? new Map<string, Vote>();
    if (!map.has(voter)) map.set(voter, vote);
    memory.votes.set(id, map);
    votes = [...map.values()];
  }

  const confirms = votes.filter((v) => v === "confirm").length;
  const flags = votes.length - confirms;
  if (flags >= FLAG_LIMIT) {
    await remove(id);
    return null;
  }
  const lifetime = LIFETIME_MIN[report.kind] * 60_000;
  const created = Date.parse(report.createdAt);
  const extended = Math.min(created + 2 * lifetime, created + lifetime + confirms * CONFIRM_EXTENSION_MIN * 60_000);
  const updated: StoredReport = {
    ...report,
    confirms,
    flags,
    expiresAt: new Date(Math.max(Date.parse(report.expiresAt), extended)).toISOString(),
  };
  await save(updated);
  return toPublic(updated);
}

export async function listReports(): Promise<PublicReport[]> {
  const now = Date.now();
  const redis = await readyRedis();
  let reports: StoredReport[];
  if (redis) {
    await redis.zremrangebyscore(KEY.index, "-inf", now);
    const ids = await redis.zrevrange(KEY.index, 0, MAX_LISTED - 1);
    if (ids.length === 0) return [];
    const raws = await redis.mget(ids.map(KEY.item));
    reports = raws.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as StoredReport);
  } else {
    for (const [id, r] of memory.items) {
      if (Date.parse(r.expiresAt) <= now) {
        memory.items.delete(id);
        memory.votes.delete(id);
      }
    }
    reports = [...memory.items.values()];
  }
  return reports
    .filter((r) => Date.parse(r.expiresAt) > now && r.flags < FLAG_LIMIT)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_LISTED)
    .map(toPublic);
}

// Distance en kilomètres (formule de haversine).
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
