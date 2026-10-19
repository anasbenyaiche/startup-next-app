import { AlertError, alertsNear, listAlerts } from "@/lib/alerts";

const MAX_RADIUS_KM = 50;

// Alertes SOS actives (15 minutes au plus). Avec ?lat=&lng=&radius= (km), seulement
// celles autour de ce point, les plus proches d'abord, avec leur distance.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" };
  if (!params.has("lat")) {
    return Response.json({ updatedAt: new Date().toISOString(), alerts: await listAlerts() }, { headers });
  }
  const radius = Math.min(MAX_RADIUS_KM, Math.max(0.1, Number(params.get("radius")) || 2));
  try {
    const alerts = await alertsNear(Number(params.get("lat")), Number(params.get("lng")), radius);
    return Response.json({ updatedAt: new Date().toISOString(), radiusKm: radius, alerts }, { headers });
  } catch (err) {
    if (err instanceof AlertError) return Response.json({ error: "Position invalide" }, { status: 400 });
    throw err;
  }
}
