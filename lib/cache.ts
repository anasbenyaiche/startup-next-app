import Redis from "ioredis";

// Cache clé/valeur JSON : Redis si REDIS_URL est défini (partagé entre toutes
// les instances et conservé aux redémarrages), sinon mémoire du processus.

type Entry = { value: string; expiresAt: number };
const MAX_MEMORY_ENTRIES = 1000;
const memory = new Map<string, Entry>();

// Une seule connexion par processus, conservée entre les rechargements à chaud en dev.
const globalForRedis = globalThis as unknown as { redis?: Redis | null };
// Vrai après une erreur de connexion, jusqu'au retour de Redis : on n'attend
// plus la connexion et on ne journalise qu'une fois par panne.
let redisDown = false;

function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  const url = process.env.REDIS_URL;
  if (!url) return (globalForRedis.redis = null);

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    if (!redisDown) console.warn(`[cache] Redis indisponible, repli sur la mémoire : ${err.message}`);
    redisDown = true;
  });
  client.on("ready", () => {
    if (redisDown) console.info("[cache] Redis de nouveau disponible");
    redisDown = false;
  });
  return (globalForRedis.redis = client);
}

// Client prêt à servir, en attendant au plus 1 s une connexion en cours
// (cas de la première requête après le démarrage du serveur).
async function readyRedis(): Promise<Redis | null> {
  const client = getRedis();
  if (!client) return null;
  if (client.status === "ready") return client;
  if (redisDown || client.status === "end" || client.status === "close") return null;
  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => done(false), 1000);
    const onReady = () => done(true);
    function done(ok: boolean) {
      clearTimeout(timer);
      client!.off("ready", onReady);
      resolve(ok);
    }
    client.once("ready", onReady);
  });
  return ready ? client : null;
}

function memoryGet(key: string): string | null {
  const e = memory.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memory.size > MAX_MEMORY_ENTRIES) {
    // Map conserve l'ordre d'insertion : la première clé est la plus ancienne.
    memory.delete(memory.keys().next().value!);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await readyRedis();
  let raw: string | null = null;
  if (redis) {
    try {
      raw = await redis.get(key);
    } catch {
      raw = null;
    }
  }
  raw ??= memoryGet(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const raw = JSON.stringify(value);
  memorySet(key, raw, ttlSeconds);
  const redis = await readyRedis();
  if (!redis) return;
  try {
    await redis.set(key, raw, "EX", ttlSeconds);
  } catch {
    // La copie en mémoire suffit en cas d'échec.
  }
}

export async function cacheBackend(): Promise<"redis" | "memory"> {
  return (await readyRedis()) ? "redis" : "memory";
}
