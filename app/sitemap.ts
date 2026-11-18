import { CURFEWS_ENABLED } from "@/lib/core/features";
import type { MetadataRoute } from "next";
import { COUNTRY_SEGMENT, LOCALES, localePath, type Locale } from "@/lib/i18n";
import { LEGAL_PAGES, LEGAL_UPDATED } from "@/lib/content/legal";
import { INFO_PAGES, INFO_UPDATED } from "@/lib/content/pages";
import { SITE_URL, countryPath, getSeoData, indexableCountries } from "@/lib/news/seo";

// Recalculé à chaque demande : la liste des pays actifs change au fil de la journée.
export const dynamic = "force-dynamic";

function entry(path: (l: Locale) => string, lastModified: Date, priority: number): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${path(l)}`]));
  return LOCALES.map((l) => ({
    url: `${SITE_URL}${path(l)}`,
    lastModified,
    changeFrequency: "hourly" as const,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSeoData(24);
  const updated = data ? new Date(data.updatedAt) : new Date();
  return [
    ...entry((l) => localePath(l, "/"), updated, 1),
    ...entry((l) => localePath(l, "/manifestations"), updated, 0.9),
    ...(CURFEWS_ENABLED ? entry((l) => localePath(l, "/couvre-feu"), updated, 0.7) : []),
    ...entry((l) => localePath(l, `/${COUNTRY_SEGMENT[l]}`), updated, 0.8),
    ...INFO_PAGES.flatMap((page) => entry((l) => localePath(l, `/${page}`), new Date(INFO_UPDATED), 0.5)),
    ...LEGAL_PAGES.flatMap((page) => entry((l) => localePath(l, `/legal/${page}`), new Date(LEGAL_UPDATED), 0.2)),
    // Seuls les pays assez fournis (INDEX_MIN_INCIDENTS) : les autres pages sont trop minces.
    ...indexableCountries(data).flatMap((c) => entry((l) => countryPath(l, c.fips), updated, 0.7)),
  ];
}
