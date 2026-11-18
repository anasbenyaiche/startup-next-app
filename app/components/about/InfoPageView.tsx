import type { Metadata } from "next";
import Footer from "@/app/components/Footer";
import { AboutContent, INFO_DESCRIPTIONS, INFO_TITLES, type InfoLang } from "@/app/components/about/AboutContent";
import { legalInfo } from "@/lib/content/legal";
import { INFO_UPDATED, type InfoPage } from "@/lib/content/pages";
import { getDictionary, localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { pageMetadata } from "@/lib/news/seo";

// Pages À propos, Méthodologie et Contact : texte en français ou en anglais (les
// autres langues affichent l'anglais, avec une note, comme les pages légales).

const infoLang = (locale: string): InfoLang => (locale === "fr" ? "fr" : "en");

export async function infoMetadata(page: InfoPage): Promise<Metadata> {
  const locale = await getLocale();
  const lang = infoLang(locale);
  return pageMetadata({
    locale,
    path: (l) => localePath(l, `/${page}`),
    title: `${INFO_TITLES[page][lang]} | Cortège`,
    description: INFO_DESCRIPTIONS[page][lang],
  });
}

export async function InfoPageView({ page }: { page: InfoPage }) {
  const locale = await getLocale();
  const lang = infoLang(locale);
  const t = getDictionary(locale).legal;
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12" lang={lang}>
        {t.onlyFrEn && (
          <p lang={locale} className="mb-6 rounded-[3px] border-[1.5px] border-encre/30 px-3 py-2 text-sm text-gris">
            {t.onlyFrEn}
          </p>
        )}
        <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{INFO_TITLES[page][lang]}</h1>
        <p className="mt-2 text-sm text-gris">
          {t.updated(new Date(INFO_UPDATED).toLocaleDateString(locale, { dateStyle: "long" }))}
        </p>
        <AboutContent page={page} lang={lang} locale={locale} info={legalInfo()} />
      </article>
      <Footer locale={locale} />
    </>
  );
}
