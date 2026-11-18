"use client";

import Script from "next/script";
import { useConsent } from "./consent";

export const ADSENSE_PUBLISHER = "ca-pub-4562660686818427";

// Script AdSense, chargé seulement si le visiteur a accepté les cookies publicitaires.
// Le site reste relié au compte par la balise google-adsense-account et ads.txt.
export default function AdsenseScript() {
  const consent = useConsent();
  if (consent !== "accepted") return null;
  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
