import { parseHours, parsePlaceKey } from "@/lib/api-params";
import { getPlaceDetails } from "@/lib/manifestations";
import { getPlaceVideos } from "@/lib/videos";

// Vidéos d'un lieu de la carte. Le nom et la position viennent du détail du lieu
// (déjà en cache) : on ne lance pas de recherche sur un texte arbitraire.
export const maxDuration = 30;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hours = parseHours(params.get("hours"));
  const key = parsePlaceKey(params.get("key"));
  if (!key) return Response.json({ error: "Clé de lieu invalide" }, { status: 400 });

  try {
    const details = await getPlaceDetails(hours, key);
    if (!details) return Response.json({ error: "Lieu inconnu sur la période" }, { status: 404 });
    const result = await getPlaceVideos({
      key,
      location: details.location,
      lat: details.lat,
      lng: details.lng,
      hours,
    });
    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return Response.json({ error: message }, { status: 502 });
  }
}
