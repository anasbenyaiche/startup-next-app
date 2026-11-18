// Pages d'information : identifiant dans l'adresse (/fr/a-propos…).
export const INFO_PAGES = ["a-propos", "methodologie", "contact"] as const;
export type InfoPage = (typeof INFO_PAGES)[number];

// Date de dernière mise à jour des textes, affichée en tête de chaque page.
export const INFO_UPDATED = "2026-11-18";

// Nombre minimal de manifestations (24 h) pour qu'une page pays soit indexée et
// listée dans le sitemap : en dessous, la page est trop mince pour les moteurs.
export const INDEX_MIN_INCIDENTS = 5;
