import { parseHours } from "@/lib/api-params";
import { getManifestations } from "@/lib/manifestations";

// Le premier calcul d'une période télécharge jusqu'à 576 fichiers GDELT. Chaque fichier
// est mis en cache dès qu'il est lu : avec Redis, si la fonction est coupée, la requête suivante reprend.
export const maxDuration = 60;

export async function GET(request: Request) {
  const hours = parseHours(new URL(request.url).searchParams.get("hours"));
  try {
    const data = await getManifestations(hours);
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return Response.json({ error: message }, { status: 502 });
  }
}
