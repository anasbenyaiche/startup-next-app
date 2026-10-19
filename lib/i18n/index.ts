import { FIPS_TO_ISO } from "@/lib/geo/countries";
import { ar } from "./dictionaries/ar";
import { de } from "./dictionaries/de";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import { pt } from "./dictionaries/pt";
import type { Dictionary, Plural } from "./types";

export type { Dictionary, Plural };

export const LOCALES = ["fr", "en", "es", "pt", "de", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lang";

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  ar: "العربية",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en, es, pt, de, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function plural(locale: Locale, n: number, forms: Plural): string {
  return new Intl.PluralRules(locale).select(n) === "one" ? forms.one : forms.other;
}

// Nom du pays dans la langue du visiteur ; repli sur le nom anglais fourni par GDELT.
export function countryName(locale: Locale, fips: string, fallback: string): string {
  const iso = FIPS_TO_ISO[fips];
  if (!iso) return fallback;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(iso) ?? fallback;
  } catch {
    return fallback;
  }
}

// Langue par défaut selon le pays (ISO) du visiteur. Les pays absents passent à l'anglais.
// Le Maghreb reste en français : c'est la langue du produit, et l'arabe reste à un clic.
const COUNTRY_LOCALE: Record<string, Locale> = {};
const assign = (locale: Locale, codes: string) => codes.split(" ").forEach((c) => (COUNTRY_LOCALE[c] = locale));
assign("fr", "FR BE LU MC SN CI ML BF NE TG BJ GN CM GA CG CD CF TD MG HT RE GP MQ GF YT NC PF PM WF MA DZ TN MR DJ KM BI");
assign("es", "ES MX AR CO PE VE CL EC GT CU BO DO HN PY SV NI CR PA UY PR GQ");
assign("pt", "PT BR AO MZ CV GW ST TL");
assign("de", "DE AT CH LI");
assign("ar", "SA AE EG IQ JO KW LB LY OM QA SY YE BH SD PS");

export function localeForCountry(iso: string | null): Locale | null {
  if (!iso) return null;
  return COUNTRY_LOCALE[iso.toUpperCase()] ?? "en";
}

// --- Adresses localisées (référencement) -----------------------------------

// Segment de l'adresse des pages pays, dans la langue de la page.
export const COUNTRY_SEGMENT: Record<Locale, string> = {
  fr: "pays",
  en: "country",
  es: "pais",
  pt: "pais",
  de: "land",
  ar: "country",
};

// Chemin public d'une page : la langue en tête, pour que chaque version ait sa propre adresse.
export function localePath(locale: Locale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}

// Identifiant lisible d'un pays dans l'adresse (« france », « allemagne »…).
// L'arabe utilise les noms anglais, pour des adresses en caractères latins.
export function countrySlug(locale: Locale, fips: string): string {
  const name = countryName(locale === "ar" ? "en" : locale, fips, fips);
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function countryPath(locale: Locale, fips: string): string {
  return localePath(locale, `/${COUNTRY_SEGMENT[locale]}/${countrySlug(locale, fips)}`);
}
