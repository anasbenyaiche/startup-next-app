import { headers } from "next/headers";

// Adresse publique du site : à définir en production (NEXT_PUBLIC_SITE_URL), sinon
// l'adresse de production fournie par Vercel, sinon le serveur local.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

// Adresse à mettre dans les liens des e-mails. En production, toujours l'adresse
// officielle : un en-tête Host falsifié ne doit pas pouvoir détourner un lien de
// réinitialisation. Ailleurs (aperçus, local), l'adresse de la requête en cours.
export async function siteOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
