import "server-only";
import { readyRedis } from "@/lib/core/cache";

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

// Clés commençant par un préfixe (administration : liste des comptes). SCAN plutôt que
// KEYS, pour ne pas bloquer Redis sur une grosse base.
export async function storeScan(prefix: string): Promise<string[]> {
  const redis = await readyRedis();
  if (redis) {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 500);
      keys.push(...batch);
      cursor = next;
    } while (cursor !== "0");
    return keys;
  }
  return [...memory.keys()].filter((k) => k.startsWith(prefix));
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
