import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { isoToFips } from "@/lib/geo/countries";
import { LOCALES, type Locale } from "@/lib/i18n";

// Contenu éditorial écrit à la main, rangé dans le dépôt (dossier content/) :
// - content/bilans/AAAA-MM-JJ-titre.md : un bilan de la semaine ;
// - content/pays/<ISO>.<langue>.md : un texte de contexte pour une page pays (FR.fr.md).
// Chaque fichier commence par un en-tête « clé: valeur » entre deux lignes « --- ».
// Les fichiers dont le nom commence par « _ » (modèles) sont ignorés.
// Mode d'emploi : content/README.md.

const ROOT = path.join(process.cwd(), "content");

export type Bilan = {
  slug: string;
  title: string;
  date: string; // AAAA-MM-JJ
  lang: Locale;
  summary: string;
  countries: string[]; // codes FIPS, comme le reste du site
  html: string;
};

export type CountryText = { html: string; updated: string | null };

type Parsed = { meta: Record<string, string>; body: string };

function parse(source: string): Parsed {
  const match = source.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: source };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (m) meta[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body: match[2] };
}

// Le contenu vient du dépôt (écrit par l'éditeur), pas des visiteurs : HTML autorisé.
const render = (markdown: string) => marked.parse(markdown, { async: false, gfm: true }) as string;

const isLocale = (v: string | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function files(dir: string): Promise<string[]> {
  try {
    return (await readdir(path.join(ROOT, dir))).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  } catch {
    return [];
  }
}

// Les fichiers ne changent qu'au déploiement : lus une fois par instance en production.
const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== "production") return load();
  if (!memo.has(key)) memo.set(key, load());
  return memo.get(key) as Promise<T>;
}

async function loadBilans(): Promise<Bilan[]> {
  const today = new Date().toISOString().slice(0, 10);
  const list: Bilan[] = [];
  for (const file of await files("bilans")) {
    const { meta, body } = parse(await readFile(path.join(ROOT, "bilans", file), "utf8"));
    const slug = file.replace(/\.md$/, "");
    const date = meta.date ?? slug.slice(0, 10);
    // Brouillon, date à venir ou en-tête incomplet : pas publié.
    if (meta.brouillon === "oui" || !meta.titre || !DATE.test(date) || date > today) continue;
    list.push({
      slug,
      title: meta.titre,
      date,
      lang: isLocale(meta.langue) ? meta.langue : "fr",
      summary: meta.resume ?? "",
      countries: (meta.pays ?? "")
        .split(/[,\s]+/)
        .map((iso) => isoToFips(iso.toUpperCase()))
        .filter((f): f is string => !!f),
      html: render(body),
    });
  }
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export const listBilans = () => once("bilans", loadBilans);

export async function getBilan(slug: string): Promise<Bilan | null> {
  return (await listBilans()).find((b) => b.slug === slug) ?? null;
}

async function loadCountryTexts(): Promise<Map<string, CountryText>> {
  const map = new Map<string, CountryText>();
  for (const file of await files("pays")) {
    const m = file.match(/^([A-Za-z]{2})\.([a-z]{2})\.md$/);
    const fips = m && isoToFips(m[1].toUpperCase());
    if (!m || !fips || !isLocale(m[2])) continue;
    const { meta, body } = parse(await readFile(path.join(ROOT, "pays", file), "utf8"));
    if (meta.brouillon === "oui" || !body.trim()) continue;
    map.set(`${fips}:${m[2]}`, { html: render(body), updated: DATE.test(meta.maj ?? "") ? meta.maj : null });
  }
  return map;
}

const countryTexts = () => once("pays", loadCountryTexts);

export async function getCountryText(fips: string, locale: Locale): Promise<CountryText | null> {
  return (await countryTexts()).get(`${fips}:${locale}`) ?? null;
}

// Pays ayant un texte écrit à la main, par langue : ces pages sont assez fournies pour être indexées.
export async function countriesWithText(): Promise<{ fips: string; locale: Locale }[]> {
  return [...(await countryTexts()).keys()].map((k) => {
    const [fips, locale] = k.split(":");
    return { fips, locale: locale as Locale };
  });
}
