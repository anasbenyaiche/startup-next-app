import { readyRedis } from "./cache";

// Stockage durable (sans expiration) pour les données des utilisateurs.
// Contrairement au cache, une perte serait visible : Redis est donc nécessaire
// en production. Sans lui, les données restent en mémoire et disparaissent
// au redémarrage, ce qui suffit pour le développement local.

const memory = new Map<string, string>();
let warned = false;

function warnMemory() {
  if (warned || process.env.NODE_ENV !== "production") return;
  warned = true;
  console.warn("[store] Redis indisponible : les profils sont gardés en mémoire et seront perdus au redémarrage.");
}

export async function storeGet<T>(key: string): Promise<T | null> {
  const redis = await readyRedis();
  if (redis) {
    const raw = await redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }
  warnMemory();
  const raw = memory.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  const redis = await readyRedis();
  if (redis) {
    await redis.set(key, raw);
    return;
  }
  warnMemory();
  memory.set(key, raw);
}

export async function storeDelete(key: string): Promise<void> {
  const redis = await readyRedis();
  if (redis) await redis.del(key);
  memory.delete(key);
}

// Compteurs anonymes (statistiques publicitaires) : un total par clé, rien de plus.
export async function storeIncrement(key: string): Promise<void> {
  const redis = await readyRedis();
  if (redis) {
    await redis.incr(key);
    return;
  }
  memory.set(key, String(Number(memory.get(key) ?? 0) + 1));
}
