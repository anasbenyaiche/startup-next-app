import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY_SEGMENT, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeForCountry, type Locale } from "@/lib/i18n";

// Adresses localisées : chaque langue a sa propre adresse (/fr/…, /en/…), pour que
// les moteurs de recherche indexent toutes les versions. Le préfixe est retiré
// avant d'atteindre les pages, qui lisent la langue dans l'en-tête x-locale.

const GEO_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-country-code"];
const COUNTRY_SEGMENTS = new Set(Object.values(COUNTRY_SEGMENT));

// Chemins servis tels quels : API, fichiers de Next et métadonnées (sitemap, robots, icônes).
function isPassthrough(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    /^\/(sitemap|robots|icon|apple-icon|opengraph-image|twitter-image|manifest)\b/.test(pathname) ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function detectLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  for (const name of GEO_HEADERS) {
    const country = req.headers.get(name);
    if (country && /^[A-Z]{2}$/i.test(country) && country !== "XX" && country !== "T1") {
      return localeForCountry(country) ?? DEFAULT_LOCALE;
    }
  }
  for (const part of (req.headers.get("accept-language") ?? "").split(",")) {
    const lang = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPassthrough(pathname)) return NextResponse.next();

  const [, first, second, ...rest] = pathname.split("/");
  if (!isLocale(first)) {
    // Adresse sans langue (liens anciens, « / ») : redirection vers la langue du visiteur.
    const url = req.nextUrl.clone();
    url.pathname = `/${detectLocale(req)}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url, 307);
  }

  // /fr/pays/france → /pays/france, /en/country/germany → /pays/germany, /fr/profil → /profil.
  const inner = second && COUNTRY_SEGMENTS.has(second) ? ["pays", ...rest] : [second, ...rest].filter((s) => s !== undefined);
  const url = req.nextUrl.clone();
  url.pathname = `/${inner.join("/")}`.replace(/\/$/, "") || "/";
  const headers = new Headers(req.headers);
  headers.set("x-locale", first);
  const res = NextResponse.rewrite(url, { request: { headers } });
  // La langue choisie dans l'adresse devient la préférence pour les adresses sans langue.
  if (req.cookies.get(LOCALE_COOKIE)?.value !== first) {
    res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
