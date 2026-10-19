import { auth } from "@/auth";
import { getProfile } from "@/lib/profile";

// Droit à la portabilité (article 20 du RGPD) : toutes les données gardées sur la
// personne connectée, dans un fichier JSON à télécharger.
export async function GET() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return Response.json({ error: "Connexion requise" }, { status: 401 });

  const data = {
    exportedAt: new Date().toISOString(),
    // Gardé dans le cookie de session chiffré, sur l'appareil de la personne.
    account: { provider: "github", id, name: session.user?.name ?? null, email: session.user?.email ?? null },
    // Gardé dans la base Redis du site.
    profile: await getProfile(id),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cortege-mes-donnees.json"',
      "Cache-Control": "no-store",
    },
  });
}
