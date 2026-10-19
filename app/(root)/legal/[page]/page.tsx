import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/app/components/Footer";
import { LEGAL_TITLES, LegalContent, type LegalLang } from "@/app/components/legal/LegalContent";
import { getDictionary, localePath } from "@/lib/i18n";
import { LEGAL_PAGES, LEGAL_UPDATED, legalInfo, type LegalPage } from "@/lib/legal";
import { getLocale } from "@/lib/locale";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ page: string }> };

function isLegalPage(page: string): page is LegalPage {
  return (LEGAL_PAGES as readonly string[]).includes(page);
}

// Les textes légaux existent en français et en anglais ; les autres langues
// affichent l'anglais, avec une note, plutôt qu'une traduction non relue.
function legalLang(locale: string): LegalLang {
  return locale === "fr" ? "fr" : "en";
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [{ page }, locale] = await Promise.all([props.params, getLocale()]);
  if (!isLegalPage(page)) return {};
  const title = LEGAL_TITLES[page][legalLang(locale)];
  return pageMetadata({
    locale,
    path: (l) => localePath(l, `/legal/${page}`),
    title: `${title} | Cortège`,
    description: title,
  });
}

export default async function LegalPageView(props: Props) {
  const [{ page }, locale] = await Promise.all([props.params, getLocale()]);
  if (!isLegalPage(page)) notFound();
  const lang = legalLang(locale);
  const t = getDictionary(locale).legal;

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12" lang={lang}>
        {t.onlyFrEn && (
          <p lang={locale} className="mb-6 rounded-[3px] border-[1.5px] border-encre/30 px-3 py-2 text-sm text-gris">
            {t.onlyFrEn}
          </p>
        )}
        <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{LEGAL_TITLES[page][lang]}</h1>
        <p className="mt-2 text-sm text-gris">
          {t.updated(new Date(LEGAL_UPDATED).toLocaleDateString(locale, { dateStyle: "long" }))}
        </p>
        <LegalContent page={page} lang={lang} info={legalInfo()} />
      </article>
      <Footer locale={locale} />
    </>
  );
}
