"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "cortege-cookie-notice";

// Bandeau d'information : le site n'utilise que des cookies nécessaires, dispensés
// de consentement, donc rien à accepter ni refuser. Le bandeau s'affiche une fois ;
// sa fermeture est gardée dans le stockage local, sans ajouter de cookie.
export default function CookieNotice({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).legal;
  const [visible, setVisible] = useState(false);

  // Lu après l'affichage pour que le rendu serveur et le navigateur concordent.
  useEffect(() => {
    try {
      setVisible(!window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const close = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Stockage indisponible (navigation privée stricte) : le bandeau reviendra.
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={t.cookies}
      className="fixed inset-x-3 bottom-3 z-[1000] sm:inset-x-auto sm:end-4 sm:bottom-4 sm:max-w-sm rounded-[3px] border-[1.5px] border-encre bg-papier p-4 text-sm shadow-[4px_4px_0_rgb(var(--encre))]"
    >
      <p className="leading-relaxed">{t.bannerText}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href={localePath(locale, "/legal/cookies")} className="font-semibold text-bleu hover:underline underline-offset-4">
          {t.bannerMore}
        </Link>
        <button
          onClick={close}
          className="rounded-[3px] border-[1.5px] border-encre bg-encre px-3 py-1.5 font-semibold text-papier hover:bg-bleu hover:border-bleu"
        >
          {t.bannerOk}
        </button>
      </div>
    </div>
  );
}
