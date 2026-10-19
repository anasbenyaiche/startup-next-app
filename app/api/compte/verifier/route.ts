import { consumeToken, getAccountByEmail, markVerified } from "@/lib/accounts";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n";

// Lien de vérification envoyé par e-mail : active le compte puis renvoie vers la
// page de connexion, avec un message de réussite ou d'erreur.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang");
  const target = new URL(localePath(isLocale(lang) ? lang : DEFAULT_LOCALE, "/connexion"), url.origin);

  const email = await consumeToken("verify", url.searchParams.get("jeton"));
  const account = email ? await getAccountByEmail(email) : null;
  if (account) {
    await markVerified(account);
    target.searchParams.set("verifie", "1");
  } else {
    target.searchParams.set("erreur", "lien");
  }
  return Response.redirect(target, 303);
}
