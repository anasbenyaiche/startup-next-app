"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  const change = (next: string) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
    router.refresh();
  };

  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(e) => change(e.target.value)}
        className="rounded-[3px] border-[1.5px] border-encre/30 bg-papier px-1.5 py-1 text-sm hover:border-encre"
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
