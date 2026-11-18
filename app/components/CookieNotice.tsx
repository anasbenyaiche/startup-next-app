"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import { onConsentOpen, useConsent, writeConsent, type Consent } from "./consent";

// Bandeau de consentement, en deux niveaux :
// - une ligne discrète, avec Refuser et Accepter au même niveau (refuser doit être
//   aussi simple qu'accepter) et un lien « Personnaliser » ;
// - un panneau détaillé par catégorie, ouvert par « Personnaliser » ou par le lien
//   « Gérer les cookies » du pied de page.
// Les cookies nécessaires (langue, connexion) sont toujours déposés ; les cookies
// publicitaires de Google AdSense seulement après accord.
export default function CookieNotice({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).legal;
  const consent = useConsent();
  const [open, setOpen] = useState<"bar" | "panel" | null>(null);
  const [ads, setAds] = useState(false);
  const adsId = useId();

  // Pas encore de choix : la ligne discrète. Lien du pied de page : le panneau détaillé.
  useEffect(() => {
    if (consent === null) setOpen((o) => o ?? "bar");
  }, [consent]);
  useEffect(
    () =>
      onConsentOpen(() => {
        setAds(consent === "accepted");
        setOpen("panel");
      }),
    [consent],
  );

  if (consent === undefined || !open) return null;

  const choose = (value: Consent) => {
    writeConsent(value);
    setOpen(null);
  };
  const small = "rounded-[3px] border-[1.5px] border-encre/60 px-2.5 py-1 font-semibold hover:bg-encre hover:text-papier";

  if (open === "bar")
    return (
      <div
        role="region"
        aria-label={t.cookies}
        className="fixed bottom-3 start-3 end-3 z-[1000] sm:end-auto sm:max-w-md rounded-[3px] border border-encre/30 bg-papier/95 px-3 py-2 text-[0.8rem] text-encre/80 shadow-sm backdrop-blur"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex-1 min-w-[12rem] leading-snug">
            {t.bannerText}{" "}
            <button
              type="button"
              onClick={() => {
                setAds(false);
                setOpen("panel");
              }}
              className="font-semibold text-bleu underline underline-offset-2"
            >
              {t.bannerCustomize}
            </button>
          </p>
          <div className="flex gap-1.5">
            <button onClick={() => choose("refused")} className={small}>
              {t.bannerRefuse}
            </button>
            <button onClick={() => choose("accepted")} className={small}>
              {t.bannerAccept}
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${adsId}-title`}
      className="fixed bottom-3 start-3 end-3 z-[1000] sm:end-auto sm:w-[26rem] max-h-[80svh] overflow-y-auto rounded-[3px] border-[1.5px] border-encre bg-papier p-4 text-sm shadow-[4px_4px_0_rgb(var(--encre))]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={`${adsId}-title`} className="text-base font-bold">
          {t.panelTitle}
        </h2>
        {consent !== null && (
          <button type="button" onClick={() => setOpen(null)} aria-label={t.close} className="text-lg leading-none text-gris hover:text-encre">
            ×
          </button>
        )}
      </div>
      <p className="mt-2 leading-relaxed text-encre/85">{t.panelIntro}</p>

      <section className="mt-4 rounded-[3px] border border-encre/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{t.necessaryTitle}</h3>
          <span className="text-xs font-semibold text-gris">{t.alwaysOn}</span>
        </div>
        <p className="mt-1 leading-relaxed text-encre/80">{t.necessaryText}</p>
      </section>

      <section className="mt-3 rounded-[3px] border border-encre/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={adsId} className="font-semibold">
            {t.adsTitle}
          </label>
          <button
            id={adsId}
            type="button"
            role="switch"
            aria-checked={ads}
            onClick={() => setAds((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full border-[1.5px] border-encre transition-colors ${ads ? "bg-encre" : "bg-papier"}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${ads ? "start-[1.4rem] bg-papier" : "start-0.5 bg-encre"}`}
            />
          </button>
        </div>
        <p className="mt-1 leading-relaxed text-encre/80">{t.adsText}</p>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={localePath(locale, "/legal/cookies")} className="font-semibold text-bleu hover:underline underline-offset-4">
          {t.bannerMore}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => choose("refused")} className={small}>
            {t.bannerRefuse}
          </button>
          <button
            onClick={() => choose(ads ? "accepted" : "refused")}
            className="rounded-[3px] border-[1.5px] border-encre bg-encre px-2.5 py-1 font-semibold text-papier hover:bg-bleu hover:border-bleu"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
