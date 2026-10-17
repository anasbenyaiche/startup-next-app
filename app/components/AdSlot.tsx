"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import { pickSponsor, sponsorText } from "@/lib/sponsors";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
const ADS_CONTACT = process.env.NEXT_PUBLIC_ADS_CONTACT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const frame = "rounded-[3px] border-[1.5px] border-encre/25 p-3 text-sm";

function Label({ text }: { text: string }) {
  return <p className="text-xs text-gris mb-1">{text}</p>;
}

// Bloc Google AdSense. Dans l'Union européenne, AdSense exige une plateforme de
// consentement certifiée : activez le message « Confidentialité et messages »
// de Google dans le tableau de bord AdSense, il est servi par ce même script.
function AdSense({ label }: { label: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Bloqueur de publicité ou script absent : le bloc reste vide.
    }
  }, []);
  return (
    <aside className={frame} aria-label={label}>
      <Label text={label} />
      <Script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle block min-h-[90px]"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

// Espace publicitaire de la carte. Ordre : annonceur direct pour le pays affiché,
// puis AdSense s'il est configuré, puis une invitation à annoncer.
export default function AdSlot({ locale, country }: { locale: Locale; country: string | null }) {
  const t = getDictionary(locale).ads;
  const sponsor = pickSponsor(country);
  const ref = useRef<HTMLElement>(null);

  // Un affichage n'est compté que quand l'annonce est réellement visible.
  useEffect(() => {
    if (!sponsor || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        navigator.sendBeacon?.(`/api/ads/view?id=${encodeURIComponent(sponsor.id)}`);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sponsor]);

  if (sponsor) {
    return (
      <aside ref={ref} className={frame} aria-label={t.label}>
        <Label text={t.label} />
        <p className="font-semibold">{sponsor.name}</p>
        <p className="mt-0.5 text-encre/80">{sponsorText(sponsor, locale)}</p>
        <a
          href={`/api/ads/click?id=${encodeURIComponent(sponsor.id)}`}
          target="_blank"
          rel="noopener sponsored"
          className="mt-1.5 inline-block font-semibold text-bleu hover:underline underline-offset-4"
        >
          {t.visit}
        </a>
      </aside>
    );
  }

  if (ADSENSE_CLIENT && ADSENSE_SLOT) return <AdSense label={t.label} />;

  if (!ADS_CONTACT) return null;
  return (
    <aside className={frame} aria-label={t.label}>
      <p className="font-semibold">{t.houseTitle}</p>
      <p className="mt-0.5 text-encre/80">{t.houseText}</p>
      <a
        href={`mailto:${ADS_CONTACT}?subject=${encodeURIComponent(t.houseSubject)}`}
        className="mt-1.5 inline-block font-semibold text-bleu hover:underline underline-offset-4"
      >
        {t.houseCta}
      </a>
    </aside>
  );
}
