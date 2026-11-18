import "server-only";
import { readyRedis } from "@/lib/core/cache";

// Limite de débit partagée : un compteur par clé sur une fenêtre fixe (Redis INCR +
// EXPIRE), ou en mémoire sans Redis. Sert aux connexions, inscriptions, e-mails
// envoyés, signalements, alertes SOS et annonces.

const memory = new Map<string, { n: number; expiresAt: number }>();

const fullKey = (key: string) => `limit:${key}`;

// Compte une tentative et renvoie vrai tant que la limite n'est pas dépassée.
export async function underLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const k = fullKey(key);
  const redis = await readyRedis();
  if (redis) {
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, windowSeconds);
    return n <= max;
  }
  const now = Date.now();
  const entry = memory.get(k);
  const next = entry && entry.expiresAt > now ? { ...entry, n: entry.n + 1 } : { n: 1, expiresAt: now + windowSeconds * 1000 };
  memory.set(k, next);
  return next.n <= max;
}

export async function resetLimit(key: string): Promise<void> {
  const k = fullKey(key);
  memory.delete(k);
  const redis = await readyRedis();
  if (redis) await redis.del(k);
}
