import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Footer from "@/app/components/Footer";
import { getBilan } from "@/lib/content/editorial";
import { legalInfo } from "@/lib/content/legal";
import { getDictionary, localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { SITE_URL, countryName, countryPath, jsonLd } from "@/lib/news/seo";

type Props = { params: Promise<{ slug: string }> };

// Un bilan n'existe que dans sa langue : une seule adresse, les autres y redirigent.
async function load(props: Props) {
  const [{ slug }, locale] = await Promise.all([props.params, getLocale()]);
  const bilan = await getBilan(decodeURIComponent(slug));
  if (!bilan) notFound();
  return { bilan, locale, path: localePath(bilan.lang, `/bilans/${bilan.slug}`) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { bilan, path } = await load(props);
  const image = `/api/og?lang=${bilan.lang}&title=${encodeURIComponent(bilan.title)}`;
  return {
    title: { absolute: `${bilan.title} | Cortège` },
    description: bilan.summary || undefined,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: "Cortège",
      title: bilan.title,
      description: bilan.summary || undefined,
      url: path,
      publishedTime: bilan.date,
      images: [{ url: image, width: 1200, height: 630, alt: bilan.title }],
    },
    twitter: { card: "summary_large_image", title: bilan.title, description: bilan.summary || undefined, images: [image] },
  };
}

export default async function BilanPage(props: Props) {
  const { bilan, locale, path } = await load(props);
  if (locale !== bilan.lang) permanentRedirect(path);
  const t = getDictionary(locale).bilans;
  const publisher = legalInfo().publisher;

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12" lang={bilan.lang}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: bilan.title,
            description: bilan.summary || undefined,
            datePublished: bilan.date,
            inLanguage: bilan.lang,
            mainEntityOfPage: `${SITE_URL}${path}`,
            author: { "@type": "Organization", name: publisher.missing ? "Cortège" : publisher.text },
            publisher: { "@type": "Organization", name: "Cortège", logo: `${SITE_URL}/logo.png` },
          })}
        />
        <nav aria-label="breadcrumb" className="text-sm text-gris">
          <Link href={localePath(locale, "/bilans")} className="hover:text-bleu hover:underline underline-offset-4">
            {t.all}
          </Link>
        </nav>
        <h1 className="mt-3 display text-[clamp(2.2rem,6vw,3.4rem)]">{bilan.title}</h1>
        <p className="mt-2 text-sm text-gris">
          {t.published(new Date(bilan.date).toLocaleDateString(locale, { dateStyle: "long", timeZone: "UTC" }))}
        </p>
        {bilan.summary && <p className="mt-6 text-lg leading-relaxed text-encre/85">{bilan.summary}</p>}
        <div className="editorial mt-6" dangerouslySetInnerHTML={{ __html: bilan.html }} />
        {bilan.countries.length > 0 && (
          <section className="mt-12 border-t border-encre/15 pt-6" aria-labelledby="pays">
            <h2 id="pays" className="text-base font-bold">
              {t.countries}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {bilan.countries.map((fips) => (
                <li key={fips}>
                  <Link
                    href={countryPath(locale, fips)}
                    className="inline-block rounded-[3px] border-[1.5px] border-encre/40 px-3 py-1 text-sm font-semibold hover:bg-encre hover:text-papier"
                  >
                    {countryName(locale, fips, fips)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <Footer locale={locale} />
    </>
  );
}
