import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import { COUNTRY_SEGMENT, getDictionary, plural } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import {
  SITE_URL,
  countryName,
  countryPath,
  countryStats,
  getSeoData,
  jsonLd,
  localePath,
  pageMetadata,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale).seo;
  return pageMetadata({
    locale,
    path: (l) => localePath(l, `/${COUNTRY_SEGMENT[l]}`),
    title: `${t.countriesTitle} | Cortège`,
    description: t.countriesDescription,
    ogTitle: t.countriesTitle,
  });
}

// Page d'accueil des pays : relie chaque page pays active, pour les visiteurs
// comme pour les moteurs de recherche.
export default async function CountriesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.seo;
  const stats = countryStats(await getSeoData(24));
  const n = (v: number) => v.toLocaleString(locale);

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: t.countriesTitle,
            itemListElement: stats.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: countryName(locale, c.fips, c.fips),
              url: `${SITE_URL}${countryPath(locale, c.fips)}`,
            })),
          })}
        />
        <header className="space-y-3">
          <h1 className="display text-[clamp(2.4rem,7vw,4rem)]">{t.countriesTitle}</h1>
          <p className="text-lg text-encre/85 max-w-[60ch]">{stats.length ? t.countriesIntro : t.countryNoData}</p>
        </header>
        <ol className="divide-y divide-encre/15 border-y-[1.5px] border-encre">
          {stats.map((c) => (
            <li key={c.fips}>
              <Link
                href={countryPath(locale, c.fips)}
                className="group flex items-baseline gap-4 py-2.5 hover:text-bleu"
              >
                <span className="flex-1 text-lg font-semibold group-hover:underline underline-offset-4">
                  {countryName(locale, c.fips, c.fips)}
                </span>
                <span className="tabular-nums">
                  <strong>{n(c.incidents)}</strong>{" "}
                  <span className="text-sm text-gris">{plural(locale, c.incidents, dict.map.protests)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <Footer locale={locale} />
    </>
  );
}
