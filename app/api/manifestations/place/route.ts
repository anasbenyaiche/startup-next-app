import { parseHours, parsePlaceKey } from "@/lib/api-params";
import { getPlaceDetails } from "@/lib/manifestations";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hours = parseHours(params.get("hours"));
  const key = parsePlaceKey(params.get("key"));
  if (!key) return Response.json({ error: "Clé de lieu invalide" }, { status: 400 });

  try {
    const details = await getPlaceDetails(hours, key);
    if (!details) return Response.json({ error: "Aucun signalement pour ce lieu sur la période" }, { status: 404 });
    return Response.json(details, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return Response.json({ error: message }, { status: 502 });
  }
}
