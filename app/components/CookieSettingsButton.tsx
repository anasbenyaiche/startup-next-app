"use client";

import { openConsent } from "./consent";

// Lien du pied de page pour revenir sur son choix de cookies.
export default function CookieSettingsButton({ label, className }: { label: string; className: string }) {
  return (
    <button type="button" onClick={openConsent} className={className}>
      {label}
    </button>
  );
}
