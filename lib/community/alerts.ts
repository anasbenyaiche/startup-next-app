import "server-only";
import { randomUUID } from "crypto";
import { readyRedis } from "@/lib/core/cache";
import { CodedError } from "@/lib/core/errors";
import { authorHash } from "@/lib/core/identity";
import { underLimit } from "@/lib/core/rate-limit";
import { distanceKm } from "@/lib/geo/distance";

// Alertes SOS : feu, casseurs ou pillage, personne blessée. Envoyées en deux gestes
// depuis la carte, visibles par tous pendant 15 minutes, puis effacées.
//
// Stockage Redis :
// - un index géographique (GEOADD / GEOSEARCH) pour trouver les alertes proches d'un point ;
// - une clé par alerte qui expire seule au bout de 15 minutes ;
// - un ensemble trié par date d'expiration, pour retirer de l'index géographique
//   les alertes expirées (un membre GEO ne peut pas expirer seul).
// Sans Redis (développement), tout reste en mémoire du processus.

export const ALERT_KINDS = ["fire", "looting", "injured"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_TTL_MS = 15 * 60_000;
// Quatre décimales, environ 10 m : les secours doivent trouver l'endroit.
const COORD_DECIMALS = 4;
const RATE_LIMIT = 3; // alertes par compte et par quart d'heure
const FLAG_LIMIT = 3;

export type SosAlert = {
  id: string;
  kind: AlertKind;
  lat: number;
  lng: number;
  createdAt: string;
  expiresAt: string;
  flags: number;
  // Exemple de démonstration, affiché comme tel.
  demo: boolean;
};

type Stored = SosAlert & { author: string };

export class AlertError extends CodedError<"invalid" | "rateLimited" | "notFound" | "forbidden" | "own"> {}

const KEY = {
  geo: "sos:v1:geo",
  expiry: "sos:v1:expiry",
  item: (id: string) => `sos:v1:item:${id}`,
  flags: (id: string) => `sos:v1:flags:${id}`,
};

const memory = {
  items: new Map<string, Stored>(),
  flags: new Map<string, Set<string>>(),
};

const round = (v: number) => Number(v.toFixed(COORD_DECIMALS));

const toPublic = (s: Stored): SosAlert => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- l'empreinte de l'auteur ne sort jamais du serveur
  const { author, ...a } = s;
  return a;
};

async function purgeExpired() {
  const now = Date.now();
  const redis = await readyRedis();
  if (redis) {
    const expired = await redis.zrangebyscore(KEY.expiry, "-inf", now);
    if (expired.length) await redis.multi().zrem(KEY.geo, ...expired).zrem(KEY.expiry, ...expired).exec();
    return;
  }
  for (const [id, a] of memory.items) {
    if (Date.parse(a.expiresAt) <= now) {
      memory.items.delete(id);
      memory.flags.delete(id);
    }
  }
}

async function save(a: Stored) {
  const ttl = Date.parse(a.expiresAt) - Date.now();
  if (ttl <= 0) return;
  const redis = await readyRedis();
  if (redis) {
    await redis
      .multi()
      .set(KEY.item(a.id), JSON.stringify(a), "PX", ttl)
      .geoadd(KEY.geo, a.lng, a.lat, a.id)
      .zadd(KEY.expiry, Date.parse(a.expiresAt), a.id)
      .exec();
    return;
  }
  memory.items.set(a.id, a);
}

async function load(id: string): Promise<Stored | null> {
  const redis = await readyRedis();
  const raw = redis ? await redis.get(KEY.item(id)) : null;
  const a = redis ? (raw ? (JSON.parse(raw) as Stored) : null) : (memory.items.get(id) ?? null);
  return a && Date.parse(a.expiresAt) > Date.now() ? a : null;
}

async function loadMany(ids: string[]): Promise<Stored[]> {
  if (ids.length === 0) return [];
  const redis = await readyRedis();
  if (!redis) return ids.map((id) => memory.items.get(id)).filter((a): a is Stored => !!a);
  return (await redis.mget(ids.map(KEY.item))).filter((r): r is string => r !== null).map((r) => JSON.parse(r) as Stored);
}

async function remove(id: string) {
  const redis = await readyRedis();
  if (redis) {
    await redis.multi().del(KEY.item(id), KEY.flags(id)).zrem(KEY.geo, id).zrem(KEY.expiry, id).exec();
    return;
  }
  memory.items.delete(id);
  memory.flags.delete(id);
}

function validPoint(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 85 && // limite de l'index géographique de Redis
    Math.abs(lng) <= 180
  );
}

function build(kind: AlertKind, lat: number, lng: number, author: string, demo: boolean, ageMs = 0): Stored {
  const created = Date.now() - ageMs;
  return {
    id: randomUUID(),
    kind,
    lat: round(lat),
    lng: round(lng),
    createdAt: new Date(created).toISOString(),
    expiresAt: new Date(created + ALERT_TTL_MS).toISOString(),
    flags: 0,
    demo,
    author,
  };
}

export async function createAlert(userId: string, input: { kind: unknown; lat: unknown; lng: unknown }): Promise<SosAlert> {
  if (!ALERT_KINDS.includes(input.kind as AlertKind) || !validPoint(input.lat, input.lng)) throw new AlertError("invalid");
  const author = authorHash(userId);
  if (!(await underLimit(`sos:${author}`, RATE_LIMIT, ALERT_TTL_MS / 1000))) throw new AlertError("rateLimited");
  const alert = build(input.kind as AlertKind, input.lat, input.lng as number, author, false);
  await save(alert);
  return toPublic(alert);
}

// Retrait par un modérateur (fausse alerte évidente, contenu abusif).
export async function removeAlert(id: string): Promise<void> {
  await remove(id);
}

// Seul l'auteur peut retirer son alerte (fausse manœuvre, situation réglée).
export async function cancelAlert(userId: string, id: string): Promise<void> {
  const a = await load(id);
  if (!a) throw new AlertError("notFound");
  if (a.author !== authorHash(userId)) throw new AlertError("forbidden");
  await remove(id);
}

// Signalement d'une fausse alerte : un par compte ; au-delà de FLAG_LIMIT, elle est retirée.
export async function flagAlert(userId: string, id: string): Promise<SosAlert | null> {
  const a = await load(id);
  if (!a) throw new AlertError("notFound");
  const voter = authorHash(userId);
  if (voter === a.author) throw new AlertError("own");
  let flags: number;
  const redis = await readyRedis();
  if (redis) {
    await redis.multi().sadd(KEY.flags(id), voter).pexpireat(KEY.flags(id), Date.parse(a.expiresAt)).exec();
    flags = await redis.scard(KEY.flags(id));
  } else {
    const set = memory.flags.get(id) ?? new Set<string>();
    set.add(voter);
    memory.flags.set(id, set);
    flags = set.size;
  }
  if (flags >= FLAG_LIMIT) {
    await remove(id);
    return null;
  }
  const updated = { ...a, flags };
  await save(updated);
  return toPublic(updated);
}

export async function listAlerts(): Promise<SosAlert[]> {
  await purgeExpired();
  const redis = await readyRedis();
  const ids = redis ? await redis.zrange(KEY.expiry, 0, -1) : [...memory.items.keys()];
  const now = Date.now();
  return (await loadMany(ids))
    .filter((a) => Date.parse(a.expiresAt) > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublic);
}

// Alertes à moins de `radiusKm` d'un point, les plus proches d'abord (GEOSEARCH).
export async function alertsNear(lat: number, lng: number, radiusKm: number): Promise<(SosAlert & { distanceKm: number })[]> {
  if (!validPoint(lat, lng)) throw new AlertError("invalid");
  await purgeExpired();
  const redis = await readyRedis();
  let found: [string, number][];
  if (redis) {
    const rows = (await redis.geosearch(KEY.geo, "FROMLONLAT", lng, lat, "BYRADIUS", radiusKm, "km", "ASC", "WITHDIST")) as [
      string,
      string,
    ][];
    found = rows.map(([id, dist]) => [id, Number(dist)]);
  } else {
    found = [...memory.items.values()]
      .map((a) => [a.id, distanceKm({ lat, lng }, a)] as [string, number])
      .filter(([, d]) => d <= radiusKm)
      .sort((a, b) => a[1] - b[1]);
  }
  const byId = new Map((await loadMany(found.map(([id]) => id))).map((a) => [a.id, a]));
  return found.flatMap(([id, d]) => {
    const a = byId.get(id);
    return a ? [{ ...toPublic(a), distanceKm: Math.round(d * 100) / 100 }] : [];
  });
}

// Exemples de démonstration autour d'un point, d'âges différents pour voir le
// compte à rebours : ils disparaissent d'eux-mêmes en moins de 15 minutes.
export async function seedDemoAlerts(lat: number, lng: number): Promise<SosAlert[]> {
  if (!validPoint(lat, lng)) throw new AlertError("invalid");
  const samples: [AlertKind, number, number, number][] = [
    ["fire", 0.004, -0.006, 2 * 60_000],
    ["looting", -0.003, 0.005, 6 * 60_000],
    ["injured", 0.0015, 0.0025, 10 * 60_000],
  ];
  const alerts = samples.map(([kind, dLat, dLng, age]) => build(kind, lat + dLat, lng + dLng, "demo", true, age));
  for (const a of alerts) await save(a);
  return alerts.map(toPublic);
}
