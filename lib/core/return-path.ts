import { localePath, type Locale } from "@/lib/i18n";

// Chemin où revenir après la connexion. N'accepte qu'un chemin local, pour que
// le site ne serve pas de redirection ouverte vers un autre domaine.
export function safeReturnPath(raw: unknown, locale: Locale): string {
  const path = typeof raw === "string" ? raw : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : localePath(locale, "/profil");
}
