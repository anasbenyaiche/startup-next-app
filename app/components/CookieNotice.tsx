"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import { onConsentOpen, useConsent, writeConsent, type Consent } from "./consent";

// Bandeau de consentement : les cookies nécessaires (langue, connexion) sont toujours
// déposés ; les cookies publicitaires de Google AdSense seulement après « Accepter ».
// Refuser est aussi simple qu'accepter, et le choix se change depuis le pied de page.
export default function CookieNotice({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).legal;
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => onConsentOpen(() => setReopened(true)), []);

  if (consent === undefined || (consent !== null && !reopened)) return null;

  const choose = (value: Consent) => {
    writeConsent(value);
    setReopened(false);
  };
  const button = "rounded-[3px] border-[1.5px] border-encre px-3 py-1.5 font-semibold";

  return (
    <div
      role="region"
      aria-label={t.cookies}
      className="fixed inset-x-3 bottom-3 z-[1000] sm:inset-x-auto sm:end-4 sm:bottom-4 sm:max-w-sm rounded-[3px] border-[1.5px] border-encre bg-papier p-4 text-sm shadow-[4px_4px_0_rgb(var(--encre))]"
    >
      <p className="leading-relaxed">{t.bannerText}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={localePath(locale, "/legal/cookies")}
          className="font-semibold text-bleu hover:underline underline-offset-4"
        >
          {t.bannerMore}
        </Link>
        <div className="flex gap-2">
          <button onClick={() => choose("refused")} className={`${button} hover:bg-encre hover:text-papier`}>
            {t.bannerRefuse}
          </button>
          <button
            onClick={() => choose("accepted")}
            className={`${button} bg-encre text-papier hover:bg-bleu hover:border-bleu`}
          >
            {t.bannerAccept}
          </button>
        </div>
      </div>
    </div>
  );
}
