import Link from "next/link";
import { COUNTRY_SEGMENT, LOCALES, LOCALE_NAMES, getDictionary, localePath, type Locale } from "@/lib/i18n";

// Pied de page : liens vers les pages principales et vers chaque langue, utiles
// aux visiteurs comme aux moteurs de recherche pour découvrir toutes les versions.
export default function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const link = "hover:text-bleu hover:underline underline-offset-4";
  return (
    <footer className="border-t-[1.5px] border-encre px-4 sm:px-6 py-8 text-sm text-gris">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row gap-6 sm:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Cortège">
          <Link href={localePath(locale, "/")} className={link}>
            {t.seo.home}
          </Link>
          <Link href={localePath(locale, "/manifestations")} className={link}>
            {t.nav.map}
          </Link>
          <Link href={localePath(locale, `/${COUNTRY_SEGMENT[locale]}`)} className={link}>
            {t.seo.allCountries}
          </Link>
          <Link href={localePath(locale, "/legal/mentions")} className={link}>
            {t.legal.notice}
          </Link>
          <Link href={localePath(locale, "/legal/confidentialite")} className={link}>
            {t.legal.privacy}
          </Link>
          <Link href={localePath(locale, "/legal/cookies")} className={link}>
            {t.legal.cookies}
          </Link>
        </nav>
        <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t.nav.language}>
          {LOCALES.map((l) => (
            <Link key={l} href={localePath(l, "/")} hrefLang={l} lang={l} className={l === locale ? "text-encre font-semibold" : link}>
              {LOCALE_NAMES[l]}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
