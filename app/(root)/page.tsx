import Link from "next/link";
import { listAlerts } from "@/lib/community/alerts";
import { heroCountries, heroPlaces } from "@/lib/news/hero";
import { isoToFips } from "@/lib/geo/countries";
import type { Metadata } from "next";
import { COUNTRY_SEGMENT, countryName, countryPath, getDictionary, localePath } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/i18n/request";
import { SITE_URL, countryStats, getSeoData, jsonLd, pageMetadata } from "@/lib/news/seo";
import Footer from "../components/Footer";
import Hero3D from "../components/hero/Hero3D";
import LiveCountries from "../components/LiveCountries";
import SosHome from "../components/SosHome";
import StaySafe from "../components/StaySafe";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale).seo;
  return pageMetadata({ locale, path: (l) => localePath(l, "/"), title: t.homeTitle, description: t.homeDescription });
}

export default async function Home() {
  const [locale, visitorIso, data6h, data24h, activeAlerts] = await Promise.all([
    getLocale(),
    getVisitorCountry(),
    getSeoData(6),
    // La scène 3D montre les 24 dernières heures : assez de colonnes même un jour calme.
    getSeoData(24),
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

  const visitorFips = visitorIso ? isoToFips(visitorIso) : null;
  // Pays parcourus par les flèches de la scène 3D, avec leur nom calculé ici (voir Hero3D).
  const heroData = data24h ? heroCountries(data24h, visitorFips) : null;
  const heroList = heroData?.countries.map((c) => ({ ...c, name: countryName(locale, c.fips, c.fips) })) ?? null;

  return (
    <>
      {/* clip et non hidden : hidden ferait de ce bloc un conteneur de défilement et casserait l'écran collant du hero. */}
      <div className="overflow-x-clip">
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
                logo: `${SITE_URL}/logo.png`,
              },
            ],
          })}
        />
        {/* Scène 3D : la banderole, puis le pays du visiteur, puis le SOS, au fil du défilement. */}
        <Hero3D
          locale={locale}
          initialPlaces={data24h ? heroPlaces(data24h) : null}
          initialCountries={heroList}
          initialIndex={heroData?.start ?? 0}
          visitorFips={visitorFips}
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20 grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <section className="rounded-[4px] border-[1.5px] border-encre/15 bg-white/40 p-5 sm:p-8 shadow-[5px_5px_0_rgb(var(--encre)/0.08)]">
            <p className="text-xl sm:text-2xl leading-relaxed max-w-[34ch]">{t.intro}</p>
            <Link
              href={localePath(locale, "/manifestations")}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[3px] border-[1.5px] border-encre bg-encre px-6 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] transition-transform hover:-translate-y-0.5 hover:bg-bleu hover:border-bleu focus-visible:outline-offset-4"
            >
              {t.cta}
            </Link>
            <p className="mt-10 text-sm text-gris max-w-[46ch] leading-relaxed">{t.sourceNote}</p>
          </section>

          <section aria-labelledby="en-direct" className="rounded-[4px] border-[1.5px] border-encre/15 bg-papier-fonce/60 p-5 sm:p-8">
            <h2 id="en-direct" className="flex items-center gap-2.5 text-xl font-bold mb-3">
              <span className="live-dot" aria-hidden="true" />
              {t.liveTitle}
            </h2>
            <LiveCountries locale={locale} visitorFips={visitorFips} initial={initial} />
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
