import { auth, currentAccount } from "@/auth";
import { getProfile } from "@/lib/profile";

async function accountExport() {
  const account = await currentAccount();
  if (!account) return null;
  const { id, email, verifiedAt, providers, createdAt } = account;
  return { id, email, verifiedAt, providers, createdAt, hasPassword: !!account.passwordHash };
}

// Droit à la portabilité (article 20 du RGPD) : toutes les données gardées sur la
// personne connectée, dans un fichier JSON à télécharger.
export async function GET() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return Response.json({ error: "Connexion requise" }, { status: 401 });

  const data = {
    exportedAt: new Date().toISOString(),
    // Gardé dans la base Redis du site (l'empreinte du mot de passe n'est pas exportée :
    // elle ne permet pas de retrouver le mot de passe et ne sert qu'à le vérifier).
    account: await accountExport(),
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
