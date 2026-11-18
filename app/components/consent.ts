"use client";

import { useEffect, useState } from "react";

// Choix du visiteur sur les cookies publicitaires (Google AdSense). Gardé dans le
// stockage local, sans cookie. Les cookies nécessaires (langue, connexion) ne
// dépendent pas de ce choix.
export type Consent = "accepted" | "refused";

const KEY = "cortege-consent";
const CHANGE = "cortege:consent";
const OPEN = "cortege:consent-open";

export function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "accepted" || v === "refused" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Stockage indisponible (navigation privée stricte) : le choix vaut pour cette page.
  }
  window.dispatchEvent(new CustomEvent<Consent>(CHANGE, { detail: value }));
}

// Rouvre le bandeau pour changer d'avis (lien « Gérer les cookies »).
export function openConsent() {
  window.dispatchEvent(new Event(OPEN));
}

export function onConsentOpen(fn: () => void): () => void {
  window.addEventListener(OPEN, fn);
  return () => window.removeEventListener(OPEN, fn);
}

// Choix courant, lu après l'affichage pour que le rendu serveur et le navigateur concordent.
// `undefined` tant qu'il n'est pas lu, `null` si le visiteur n'a pas encore choisi.
export function useConsent(): Consent | null | undefined {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  useEffect(() => {
    setConsent(readConsent());
    const update = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CHANGE, update);
    return () => window.removeEventListener(CHANGE, update);
  }, []);
  return consent;
}
