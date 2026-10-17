"use client";

import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, isLocale, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  // Même page, dans l'autre langue : on remplace le préfixe de l'adresse (/fr/… → /en/…).
  // Les pages pays retrouvent le pays quelle que soit la langue du nom dans l'adresse.
  const change = (next: string) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
    const [, first, ...rest] = window.location.pathname.split("/");
    const path = isLocale(first) ? rest.join("/") : [first, ...rest].join("/");
    // Rechargement complet : la barre de navigation et l'attribut lang de la page
    // appartiennent à des mises en page que la navigation côté client ne refait pas.
    window.location.assign(`/${next}${path ? `/${path}` : ""}${window.location.search}`);
  };

  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(e) => change(e.target.value)}
        className="max-w-[6.5rem] rounded-[3px] border-[1.5px] border-encre/30 bg-papier px-1.5 py-1 text-sm hover:border-encre"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
