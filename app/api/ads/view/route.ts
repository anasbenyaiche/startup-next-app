import { adStatKey, findSponsor } from "@/lib/sponsors";
import { storeIncrement } from "@/lib/store";

// Compte un affichage (envoyé quand l'annonce devient visible). Rien n'est
// enregistré sur la personne : seulement un total par annonce et par mois.
export async function POST(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (findSponsor(id)) await storeIncrement(adStatKey(id, "views")).catch(() => {});
  return new Response(null, { status: 204 });
}
