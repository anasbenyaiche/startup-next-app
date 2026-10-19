import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, localeForCountry, type Locale } from "@/lib/i18n";

// En-têtes de géolocalisation posés par les hébergeurs et CDN courants.
const GEO_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-country-code"];

// Pays du visiteur (ISO 3166-1), d'après l'adresse IP vue par l'hébergeur,
// ou à défaut la région de la langue du navigateur (fr-FR → FR).
export async function getVisitorCountry(): Promise<string | null> {
  const h = await headers();
  for (const name of GEO_HEADERS) {
    const value = h.get(name)?.toUpperCase();
    // Cloudflare renvoie XX (inconnu) ou T1 (Tor).
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") return value;
  }
  const region = h.get("accept-language")?.match(/^[a-z]{2,3}-([A-Z]{2})\b/i)?.[1];
  return region ? region.toUpperCase() : null;
}

function fromAcceptLanguage(value: string | null): Locale | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const lang = part.trim().slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return null;
}

// Langue : celle de l'adresse (/fr/…, posée par le middleware), sinon choix explicite
// (cookie) > pays du visiteur > langue du navigateur > français.
export async function getLocale(): Promise<Locale> {
  const fromUrl = (await headers()).get("x-locale");
  if (isLocale(fromUrl)) return fromUrl;

  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const h = await headers();
  const hasGeo = GEO_HEADERS.some((name) => h.get(name));
  if (hasGeo) {
    const byCountry = localeForCountry(await getVisitorCountry());
    if (byCountry) return byCountry;
  }
  return fromAcceptLanguage(h.get("accept-language")) ?? DEFAULT_LOCALE;
}
