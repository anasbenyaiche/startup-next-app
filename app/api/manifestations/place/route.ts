import { parseHours, parsePlaceKey } from "@/lib/news/api-params";
import { getPlaceDetails } from "@/lib/news/manifestations";

// Le premier calcul d'une période télécharge jusqu'à 576 fichiers GDELT. Chaque fichier
// est mis en cache dès qu'il est lu : avec Redis, si la fonction est coupée, la requête suivante reprend.
export const maxDuration = 60;

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
