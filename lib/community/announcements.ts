import "server-only";
import { randomUUID } from "crypto";
import { readyRedis } from "@/lib/core/cache";
import { checkAnnouncement, LIMITS, type AnnouncementInput, type ComplianceReport } from "@/lib/community/compliance";
import { isCountryCode } from "@/lib/users/profile";
import { CodedError } from "@/lib/core/errors";
import { authorHash } from "@/lib/core/identity";
import { underLimit } from "@/lib/core/rate-limit";

// Manifestations annoncées par les utilisateurs (page « Créer »). Chaque publication
// passe la vérification de conformité (lib/compliance.ts) : publiée, mise en
// relecture, ou refusée avec la liste des corrections à faire. L'auteur n'est
// jamais publié ; seule une empreinte de son compte est gardée.

export const ANNOUNCEMENT_KINDS = ["march", "gathering", "strike", "blockade", "other"] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export type AnnouncementStatus = "published" | "review" | "rejected";

export type Announcement = Omit<AnnouncementInput, "organizer" | "sourceUrl"> & {
  id: string;
  kind: AnnouncementKind;
  organizer: string | null;
  sourceUrl: string | null;
  status: AnnouncementStatus;
  compliance: ComplianceReport;
  flags: number;
  createdAt: string;
  updatedAt: string;
};

type Stored = Announcement & { author: string };

export class AnnouncementError extends CodedError<"invalid" | "rateLimited" | "notFound" | "forbidden" | "own"> {}

// Au-delà, l'annonce repasse en relecture.
export const FLAG_LIMIT = 3;
const PER_DAY = 5;
// Une annonce est gardée deux jours après sa fin (ou son début), puis effacée.
const KEEP_AFTER_MS = 2 * 86_400_000;

const KEY = {
  index: "ann:v1:index",
  item: (id: string) => `ann:v1:item:${id}`,
  author: (hash: string) => `ann:v1:author:${hash}`,
  flags: (id: string) => `ann:v1:flags:${id}`,
};

const memory = {
  items: new Map<string, Stored>(),
  flags: new Map<string, Set<string>>(),
};

const endOf = (a: Pick<Announcement, "startsAt" | "endsAt">) => Date.parse(a.endsAt ?? a.startsAt);
const statusOf = (report: ComplianceReport): AnnouncementStatus =>
  report.status === "blocked" ? "rejected" : report.status === "review" ? "review" : "published";

const toPublic = (s: Stored): Announcement => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- l'empreinte de l'auteur ne sort jamais du serveur
  const { author, ...a } = s;
  return a;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max + 1) : "");
const optional = (v: unknown, max: number) => str(v, max) || null;

// Ce qui vient du navigateur est remis en forme avant la vérification ; les
// longueurs sont gardées un caractère au-delà de la limite pour que la vérification le signale.
export function parseInput(raw: Record<string, unknown>): AnnouncementInput & { kind: AnnouncementKind } {
  const kind = ANNOUNCEMENT_KINDS.includes(raw.kind as AnnouncementKind) ? (raw.kind as AnnouncementKind) : "other";
  const date = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : "");
  return {
    kind,
    title: str(raw.title, LIMITS.title),
    description: str(raw.description, LIMITS.description),
    city: str(raw.city, LIMITS.city),
    meetingPoint: str(raw.meetingPoint, LIMITS.meetingPoint),
    organizer: optional(raw.organizer, LIMITS.organizer),
    sourceUrl: optional(raw.sourceUrl, LIMITS.sourceUrl),
    country: isCountryCode(raw.country) ? raw.country : "",
    lat: typeof raw.lat === "number" ? Number(raw.lat.toFixed(5)) : NaN,
    lng: typeof raw.lng === "number" ? Number(raw.lng.toFixed(5)) : NaN,
    startsAt: date(raw.startsAt),
    endsAt: date(raw.endsAt) || null,
    declared: raw.declared === true,
  };
}

async function save(s: Stored) {
  const ttl = Math.max(60_000, endOf(s) + KEEP_AFTER_MS - Date.now());
  const redis = await readyRedis();
  if (redis) {
    await redis
      .multi()
      .set(KEY.item(s.id), JSON.stringify(s), "PX", ttl)
      .zadd(KEY.index, endOf(s) + KEEP_AFTER_MS, s.id)
      .sadd(KEY.author(s.author), s.id)
      .pexpire(KEY.flags(s.id), ttl)
      .exec();
    return;
  }
  memory.items.set(s.id, s);
}

async function load(id: string): Promise<Stored | null> {
  const redis = await readyRedis();
  if (redis) {
    const raw = await redis.get(KEY.item(id));
    return raw ? (JSON.parse(raw) as Stored) : null;
  }
  return memory.items.get(id) ?? null;
}

async function loadAll(): Promise<Stored[]> {
  const now = Date.now();
  const redis = await readyRedis();
  if (redis) {
    await redis.zremrangebyscore(KEY.index, "-inf", now);
    const ids = await redis.zrange(KEY.index, 0, -1);
    if (ids.length === 0) return [];
    return (await redis.mget(ids.map(KEY.item))).filter((r): r is string => r !== null).map((r) => JSON.parse(r) as Stored);
  }
  for (const [id, s] of memory.items) if (endOf(s) + KEEP_AFTER_MS < now) memory.items.delete(id);
  return [...memory.items.values()];
}

async function byAuthor(hash: string): Promise<Stored[]> {
  const redis = await readyRedis();
  if (redis) {
    const ids = await redis.smembers(KEY.author(hash));
    if (ids.length === 0) return [];
    const raws = await redis.mget(ids.map(KEY.item));
    // Les annonces expirées ont disparu : on retire leurs identifiants de la liste de l'auteur.
    const gone = ids.filter((_, i) => raws[i] === null);
    if (gone.length) await redis.srem(KEY.author(hash), ...gone);
    return raws.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as Stored);
  }
  return [...memory.items.values()].filter((s) => s.author === hash);
}

// Publication : la vérification de conformité tourne juste après la saisie.
// Une annonce refusée n'est pas enregistrée ; l'auteur reçoit le rapport pour corriger.
export async function publishAnnouncement(
  userId: string,
  raw: Record<string, unknown>,
): Promise<{ announcement: Announcement | null; report: ComplianceReport }> {
  const input = parseInput(raw);
  const author = authorHash(userId);
  const mine = await byAuthor(author);
  const report = checkAnnouncement(input, { sameAuthor: mine.map((m) => ({ title: m.title, startsAt: m.startsAt })) });
  if (report.status === "blocked") return { announcement: null, report };

  if (!(await underLimit(`announcement:${author}`, PER_DAY, 86_400))) throw new AnnouncementError("rateLimited");
  const now = new Date().toISOString();
  const stored: Stored = {
    ...input,
    id: randomUUID(),
    status: statusOf(report),
    compliance: report,
    flags: 0,
    createdAt: now,
    updatedAt: now,
    author,
  };
  await save(stored);
  return { announcement: toPublic(stored), report };
}

// Annonces visibles par tous : publiées et pas encore terminées.
export async function listPublished(): Promise<Announcement[]> {
  const now = Date.now();
  return (await loadAll())
    .filter((s) => s.status === "published" && endOf(s) + 3 * 3600_000 > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(toPublic);
}

export async function listMine(userId: string): Promise<Announcement[]> {
  return (await byAuthor(authorHash(userId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toPublic);
}

export async function listForModeration(): Promise<Announcement[]> {
  return (await loadAll())
    .filter((s) => s.status === "review")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPublic);
}

export async function deleteAnnouncement(userId: string, id: string): Promise<void> {
  const s = await load(id);
  if (!s) throw new AnnouncementError("notFound");
  if (s.author !== authorHash(userId)) throw new AnnouncementError("forbidden");
  await remove(s);
}

async function remove(s: Stored) {
  const redis = await readyRedis();
  if (redis) {
    await redis.multi().del(KEY.item(s.id), KEY.flags(s.id)).zrem(KEY.index, s.id).srem(KEY.author(s.author), s.id).exec();
    return;
  }
  memory.items.delete(s.id);
  memory.flags.delete(s.id);
}

// Signalement d'abus : un par compte ; au-delà de FLAG_LIMIT, l'annonce repasse en relecture.
export async function flagAnnouncement(userId: string, id: string): Promise<Announcement> {
  const s = await load(id);
  if (!s || s.status !== "published") throw new AnnouncementError("notFound");
  const voter = authorHash(userId);
  if (voter === s.author) throw new AnnouncementError("own");
  let flags: number;
  const redis = await readyRedis();
  if (redis) {
    await redis.sadd(KEY.flags(id), voter);
    flags = await redis.scard(KEY.flags(id));
  } else {
    const set = memory.flags.get(id) ?? new Set<string>();
    set.add(voter);
    memory.flags.set(id, set);
    flags = set.size;
  }
  const updated: Stored = {
    ...s,
    flags,
    status: flags >= FLAG_LIMIT ? "review" : s.status,
    updatedAt: new Date().toISOString(),
  };
  await save(updated);
  return toPublic(updated);
}

// Décision d'un modérateur. Une annonce approuvée repart sans signalements d'abus.
export async function moderateAnnouncement(id: string, decision: "approve" | "reject"): Promise<void> {
  const s = await load(id);
  if (!s) throw new AnnouncementError("notFound");
  if (decision === "reject") return remove(s);
  const redis = await readyRedis();
  if (redis) await redis.del(KEY.flags(id));
  else memory.flags.delete(id);
  await save({ ...s, status: "published", flags: 0, updatedAt: new Date().toISOString() });
}

// Nouvelle vérification de toutes les annonces (tâche quotidienne) : une annonce
// qui ne passe plus les règles actuelles est retirée de la carte et repasse en relecture.
// Les annonces approuvées par un modérateur ne sont remises en cause que par un blocage.
export async function recheckAll(): Promise<{ checked: number; toReview: number; rejected: number }> {
  const all = await loadAll();
  let toReview = 0;
  let rejected = 0;
  for (const s of all) {
    if (endOf(s) < Date.now()) continue;
    // La date passée n'est plus une erreur pour une annonce déjà publiée : on vérifie au moment de la publication.
    const report = checkAnnouncement(s, { now: Date.parse(s.createdAt) });
    let status = s.status;
    if (report.status === "blocked") status = "review";
    else if (report.status === "review" && s.status === "published" && s.compliance.status === "ok") status = "review";
    if (status === "review" && s.status !== "review") toReview++;
    if (report.status === "blocked") rejected++;
    await save({ ...s, compliance: { ...report, checkedAt: new Date().toISOString() }, status });
  }
  return { checked: all.length, toReview, rejected };
}
