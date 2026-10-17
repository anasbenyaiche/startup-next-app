import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import { notFound, permanentRedirect } from "next/navigation";
import { FAMILY_COLORS, FAMILY_ORDER, TYPE_FAMILY } from "@/app/components/map-colors";
import { COUNTRY_SEGMENT, countrySlug, getDictionary, plural } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import {
  SITE_URL,
  countryName,
  countryPath,
  countryStats,
  fipsFromSlug,
  getSeoData,
  jsonLd,
  localePath,
  pageMetadata,
} from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

// Page indexable d'un pays : rendue côté serveur avec les chiffres en cache, pour
// répondre aux recherches « manifestation <pays> aujourd'hui ».
async function load(props: Props) {
  const [{ slug }, locale] = await Promise.all([props.params, getLocale()]);
  const fips = fipsFromSlug(decodeURIComponent(slug));
  if (!fips) notFound();
  return { slug, locale, fips, name: countryName(locale, fips, fips) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, fips, name } = await load(props);
  const t = getDictionary(locale).seo;
  const data = await getSeoData(24);
  const stat = countryStats(data).find((c) => c.fips === fips);
  const meta = pageMetadata({
    locale,
    path: (l) => countryPath(l, fips),
    title: `${t.countryTitle(name)} | Cortège`,
    description: stat ? t.countryDescription(name, stat.incidents) : t.countryNoData,
    ogTitle: t.countryTitle(name),
  });
  // Sans manifestation récente, la page est trop pauvre pour être indexée.
  return stat ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function CountryPage(props: Props) {
  const { slug, locale, fips, name } = await load(props);
  // Une seule adresse par pays et par langue : les autres formes y redirigent.
  if (slug !== countrySlug(locale, fips)) permanentRedirect(countryPath(locale, fips));

  const dict = getDictionary(locale);
  const t = dict.seo;
  const data = await getSeoData(24);
  const stats = countryStats(data);
  const stat = stats.find((c) => c.fips === fips);
  const places = (data?.places ?? [])
    .filter((p) => p.country === fips)
    .map((p) => ({
      ...p,
      incidents: Object.values(p.byType).reduce((n, s) => n + s.incidents, 0),
      families: Object.entries(p.byType).reduce<Record<string, number>>((acc, [type, s]) => {
        acc[TYPE_FAMILY[type]] = (acc[TYPE_FAMILY[type]] ?? 0) + s.incidents;
        return acc;
      }, {}),
    }))
    .sort((a, b) => b.incidents - a.incidents);
  const families = FAMILY_ORDER.map((f) => ({ f, n: places.reduce((sum, p) => sum + (p.families[f] ?? 0), 0) })).filter(
    (x) => x.n > 0,
  );
  const others = stats.filter((c) => c.fips !== fips).slice(0, 12);
  const mapHref = localePath(locale, `/manifestations?pays=${fips}`);
  const hubHref = localePath(locale, `/${COUNTRY_SEGMENT[locale]}`);
  const n = (v: number) => v.toLocaleString(locale);
  const time = data ? new Date(data.updatedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: t.home, item: `${SITE_URL}${localePath(locale, "/")}` },
                  { "@type": "ListItem", position: 2, name: t.allCountries, item: `${SITE_URL}${hubHref}` },
                  { "@type": "ListItem", position: 3, name, item: `${SITE_URL}${countryPath(locale, fips)}` },
                ],
              },
              ...(places.length
                ? [
                    {
                      "@type": "ItemList",
                      name: t.topPlaces,
                      itemListElement: places.slice(0, 20).map((p, i) => ({
                        "@type": "ListItem",
                        position: i + 1,
                        name: p.location,
                      })),
                    },
                  ]
                : []),
            ],
          })}
        />

        <nav aria-label="breadcrumb" className="text-sm text-gris">
          <ol className="flex flex-wrap gap-x-2">
            <li>
              <Link href={localePath(locale, "/")} className="hover:text-bleu hover:underline underline-offset-4">
                {t.home}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={hubHref} className="hover:text-bleu hover:underline underline-offset-4">
                {t.allCountries}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-encre">
              {name}
            </li>
          </ol>
        </nav>

        <header className="space-y-4">
          <h1 className="display text-[clamp(2.4rem,7vw,4rem)]">{t.countryTitle(name)}</h1>
          <p className="text-lg leading-relaxed text-encre/85 max-w-[60ch]">
            {stat
            ? t.countryIntro(
                `${n(stat.incidents)} ${plural(locale, stat.incidents, dict.map.protests)}`,
                `${n(stat.places)} ${plural(locale, stat.places, dict.map.places)}`,
                time,
              )
            : t.countryNoData}
          </p>
          <Link
            href={mapHref}
            className="inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu"
          >
            {t.openMap}
          </Link>
        </header>

        {families.length > 0 && (
          <section aria-labelledby="types">
            <h2 id="types" className="text-xl font-bold mb-3">
              {t.byFamily}
            </h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {families.map(({ f, n: count }) => (
                <li key={f} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: FAMILY_COLORS[f as keyof typeof FAMILY_COLORS] }}
                  />
                  {dict.families[f]}
                  <span className="font-semibold tabular-nums">{n(count)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {places.length > 0 && (
          <section aria-labelledby="places">
            <h2 id="places" className="text-xl font-bold mb-2">
              {t.topPlaces}
            </h2>
            <ol className="divide-y divide-encre/15 border-y-[1.5px] border-encre">
              {places.slice(0, 20).map((p) => {
                const [city, ...rest] = p.location.split(",").map((s) => s.trim());
                return (
                  <li key={p.key}>
                    <Link
                      href={localePath(locale, `/manifestations?pays=${fips}&lieu=${encodeURIComponent(p.key)}`)}
                      className="group flex items-baseline gap-4 py-3 hover:text-bleu"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-lg font-semibold group-hover:underline underline-offset-4">
                          {city}
                        </span>
                        <span className="block text-sm text-gris">
                          {[
                            rest.slice(0, -1).join(", "),
                            p.precision === "region" ? dict.map.approx : null,
                            t.reliabilityShort(p.reliability),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                      <span className="text-end">
                        <span className="block text-lg font-semibold tabular-nums">{n(p.incidents)}</span>
                        <span className="block text-xs text-gris">
                          {plural(locale, p.incidents, dict.map.protests)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {others.length > 0 && (
          <section aria-labelledby="others">
            <h2 id="others" className="text-xl font-bold mb-2">
              {t.otherCountries}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {others.map((c) => (
                <li key={c.fips}>
                  <Link
                    href={countryPath(locale, c.fips)}
                    className="inline-block rounded-full border-[1.5px] border-encre/30 px-3 py-1 hover:border-encre hover:text-bleu"
                  >
                    {countryName(locale, c.fips, c.fips)}{" "}
                    <span className="text-gris tabular-nums">{n(c.incidents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t-[1.5px] border-encre pt-4 text-sm text-gris max-w-[65ch] leading-relaxed">
          <p>{dict.home.sourceNote}</p>
          <p className="mt-2">{dict.details.methodText}</p>
        </footer>
      </div>
      <Footer locale={locale} />
    </>
  );
}
