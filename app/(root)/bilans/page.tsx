import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import { listBilans } from "@/lib/content/editorial";
import { LOCALE_NAMES, getDictionary, localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { pageMetadata } from "@/lib/news/seo";

// Liste des bilans de la semaine (content/bilans). Sans bilan publié, la page
// n'est pas proposée aux moteurs de recherche.
export async function generateMetadata(): Promise<Metadata> {
  const [locale, bilans] = await Promise.all([getLocale(), listBilans()]);
  const t = getDictionary(locale).bilans;
  const meta = pageMetadata({
    locale,
    path: (l) => localePath(l, "/bilans"),
    title: `${t.title} | Cortège`,
    description: t.description,
  });
  return bilans.length ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function BilansPage() {
  const [locale, bilans] = await Promise.all([getLocale(), listBilans()]);
  const t = getDictionary(locale).bilans;
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{t.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-encre/85 max-w-[60ch]">{t.intro}</p>
        {bilans.length === 0 ? (
          <p className="mt-10 text-gris">{t.empty}</p>
        ) : (
          <ol className="mt-10 divide-y divide-encre/15 border-y border-encre/15">
            {bilans.map((b) => (
              <li key={b.slug} className="py-5" lang={b.lang}>
                <p className="text-sm text-gris">
                  {t.published(new Date(b.date).toLocaleDateString(locale, { dateStyle: "long", timeZone: "UTC" }))}
                  {b.lang !== locale && <> · {LOCALE_NAMES[b.lang]}</>}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  <Link href={localePath(b.lang, `/bilans/${b.slug}`)} className="hover:text-bleu hover:underline underline-offset-4">
                    {b.title}
                  </Link>
                </h2>
                {b.summary && <p className="mt-2 leading-relaxed text-encre/85">{b.summary}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Footer locale={locale} />
    </>
  );
}
