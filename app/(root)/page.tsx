import Link from "next/link";
import { listAlerts } from "@/lib/alerts";
import { isoToFips } from "@/lib/countries";
import type { Metadata } from "next";
import { COUNTRY_SEGMENT, countryName, countryPath, getDictionary, localePath } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/locale";
import { SITE_URL, countryStats, getSeoData, jsonLd, pageMetadata } from "@/lib/seo";
import Footer from "../components/Footer";
import LiveCountries from "../components/LiveCountries";
import SosHome from "../components/SosHome";
import StaySafe from "../components/StaySafe";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale).seo;
  return pageMetadata({ locale, path: (l) => localePath(l, "/"), title: t.homeTitle, description: t.homeDescription });
}

export default async function Home() {
  const [locale, visitorIso, data6h, activeAlerts] = await Promise.all([
    getLocale(),
    getVisitorCountry(),
    getSeoData(6),
    // Un Redis injoignable ne doit pas empêcher l'accueil de s'afficher.
    listAlerts().then((a) => a.length, () => 0),
  ]);
  const dict = getDictionary(locale);
  const t = dict.home;
  // Classement rendu côté serveur quand les données sont en cache : lisible par
  // les moteurs de recherche, et affiché sans attente.
  const initial = data6h
    ? {
        updatedAt: data6h.updatedAt,
        countries: countryStats(data6h).map((c) => ({
          code: c.fips,
          name: countryName(locale, c.fips, c.fips),
          count: c.incidents,
          href: countryPath(locale, c.fips),
        })),
      }
    : null;

  return (
    <>
      <div className="overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                name: "Cortège",
                url: `${SITE_URL}${localePath(locale, "/")}`,
                inLanguage: locale,
                description: dict.seo.homeDescription,
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: "Cortège",
                url: SITE_URL,
                logo: `${SITE_URL}/icon.svg`,
              },
            ],
          })}
        />
        {/* La banderole : tendue d'un bord à l'autre, légèrement de travers. */}
        <section aria-labelledby="titre" className="pt-14 sm:pt-20 pb-10">
          <div className="-mx-4 -rotate-2 bg-rose border-y-[3px] border-encre px-8 py-6 sm:py-8">
            <h1 id="titre" className="display text-center text-balance text-encre text-[clamp(2.6rem,9vw,8rem)]">
              {t.banner}
            </h1>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <section>
            <p className="text-xl leading-relaxed max-w-[34ch]">{t.intro}</p>
            <Link
              href={localePath(locale, "/manifestations")}
              className="mt-8 inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu"
            >
              {t.cta}
            </Link>
            <p className="mt-10 text-sm text-gris max-w-[46ch] leading-relaxed">{t.sourceNote}</p>
          </section>

          <section aria-labelledby="en-direct">
            <h2 id="en-direct" className="flex items-center gap-2.5 text-xl font-bold mb-3">
              <span className="live-dot" aria-hidden="true" />
              {t.liveTitle}
            </h2>
            <LiveCountries locale={locale} visitorFips={visitorIso ? isoToFips(visitorIso) : null} initial={initial} />
            <Link
              href={localePath(locale, `/${COUNTRY_SEGMENT[locale]}`)}
              className="mt-4 inline-block font-semibold text-bleu hover:underline underline-offset-4"
            >
              {dict.seo.allCountries}
            </Link>
          </section>
        </div>
        <SosHome locale={locale} activeCount={activeAlerts} />
        <StaySafe locale={locale} visitorIso={visitorIso} />
      </div>
      <Footer locale={locale} />
    </>
  );
}
