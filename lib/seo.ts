import type { Metadata } from "next";
import { after } from "next/server";
import { FIPS_TO_ISO, isoToFips } from "./countries";
import { LOCALES, countryName, countryPath, countrySlug, localePath, type Locale } from "./i18n";
import { getCachedManifestations, getManifestations, type ManifestationsResult } from "./manifestations";

// Adresse publique du site : à définir en production (NEXT_PUBLIC_SITE_URL), sinon
// l'adresse de production fournie par Vercel, sinon le serveur local.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

const OG_LOCALE: Record<Locale, string> = { fr: "fr_FR", en: "en_US", es: "es_ES", pt: "pt_PT", de: "de_DE", ar: "ar_AR" };

// Métadonnées d'une page : adresse canonique, versions dans les autres langues
// (hreflang), aperçu pour les réseaux sociaux.
export function pageMetadata({
  locale,
  path,
  title,
  description,
  ogTitle,
}: {
  locale: Locale;
  // Chemin de la page dans une langue donnée (les pages pays changent d'adresse selon la langue).
  path: (l: Locale) => string;
  title: string;
  description: string;
  ogTitle?: string;
}): Metadata {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, path(l)]));
  // Version par défaut : l'adresse sans langue, qui redirige selon le visiteur.
  languages["x-default"] = path(locale).replace(/^\/[a-z]{2}/, "") || "/";
  const image = `/api/og?lang=${locale}&title=${encodeURIComponent(ogTitle ?? title)}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path(locale), languages },
    openGraph: {
      type: "website",
      siteName: "Cortège",
      title,
      description,
      url: path(locale),
      locale: OG_LOCALE[locale],
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

// Données pour les pages indexables : le dernier agrégat en cache. S'il manque,
// le calcul est lancé après la réponse, pour la visite suivante.
export async function getSeoData(hours = 24): Promise<ManifestationsResult | null> {
  const cached = await getCachedManifestations(hours).catch(() => null);
  if (!cached) after(() => getManifestations(hours).catch(() => {}));
  return cached;
}

export type CountryStat = { fips: string; incidents: number; places: number };

export function countryStats(data: ManifestationsResult | null): CountryStat[] {
  if (!data) return [];
  const byCountry = new Map<string, CountryStat>();
  for (const p of data.places) {
    const c = byCountry.get(p.country) ?? { fips: p.country, incidents: 0, places: 0 };
    c.incidents += Object.values(p.byType).reduce((n, s) => n + s.incidents, 0);
    c.places++;
    byCountry.set(p.country, c);
  }
  return [...byCountry.values()].filter((c) => c.fips in FIPS_TO_ISO).sort((a, b) => b.incidents - a.incidents);
}

// Un code FIPS par pays ISO (plusieurs FIPS désignent parfois le même pays).
export function allCountryCodes(): string[] {
  return [...new Set(Object.values(FIPS_TO_ISO))].map((iso) => isoToFips(iso)).filter((f): f is string => !!f);
}

let slugIndex: Map<string, string> | null = null;

// Retrouve un pays depuis l'adresse, quelle que soit la langue du nom
// (« allemagne », « germany », « deutschland »), ou depuis son code ISO ou FIPS.
export function fipsFromSlug(slug: string): string | null {
  if (!slugIndex) {
    slugIndex = new Map();
    for (const fips of allCountryCodes()) {
      for (const l of LOCALES) slugIndex.set(countrySlug(l, fips), fips);
      slugIndex.set(FIPS_TO_ISO[fips].toLowerCase(), fips);
    }
  }
  const s = slug.toLowerCase();
  return slugIndex.get(s) ?? (s.toUpperCase() in FIPS_TO_ISO ? s.toUpperCase() : null);
}

export { countryName, countryPath, localePath };

// Données structurées (schema.org) insérées dans la page.
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
