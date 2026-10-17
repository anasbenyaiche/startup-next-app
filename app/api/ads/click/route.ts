import { adStatKey, findSponsor } from "@/lib/sponsors";
import { storeIncrement } from "@/lib/store";

// Compte le clic puis redirige vers l'annonceur. Seuls les annonceurs déclarés
// dans lib/sponsors.ts sont acceptés : la route ne redirige pas vers n'importe où.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const sponsor = findSponsor(id);
  if (!sponsor) return new Response("Annonce inconnue", { status: 404 });
  await storeIncrement(adStatKey(sponsor.id, "clicks")).catch(() => {});
  return Response.redirect(sponsor.url, 302);
}
