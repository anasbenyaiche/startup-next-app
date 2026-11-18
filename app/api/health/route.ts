import { cacheBackend } from "@/lib/core/cache";
import { getCachedManifestations } from "@/lib/news/manifestations";

// Contrôle de santé léger : aucune collecte déclenchée par la supervision.
export const dynamic = "force-dynamic";

export async function GET() {
  const [backend, data] = await Promise.all([cacheBackend(), getCachedManifestations(6)]);
  const ageMinutes = data ? Math.max(0, Math.floor((Date.now() - Date.parse(data.updatedAt)) / 60_000)) : null;
  const fresh = ageMinutes !== null && Number.isFinite(ageMinutes) && ageMinutes <= 45 && data?.partial === false;
  const storageOk = process.env.NODE_ENV !== "production" || backend === "redis";
  const ok = fresh && storageOk;
  return Response.json(
    { status: ok ? "ok" : "degraded", storage: backend, feed: { updatedAt: data?.updatedAt ?? null, ageMinutes, fresh } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
