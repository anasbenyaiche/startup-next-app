import type { Locale } from "./i18n";

// Annonceurs directs : l'espace est vendu par vous, sans régie ni pistage.
// Le ciblage est contextuel : il dépend du pays affiché sur la carte, jamais
// de la personne qui regarde (ses suivis peuvent révéler des opinions politiques).
//
// Pour ajouter un annonceur, ajoutez une entrée ci-dessous et redéployez.

export type Sponsor = {
  id: string;
  name: string;
  url: string;
  // Texte par langue ; repli sur le français puis l'anglais.
  text: Partial<Record<Locale, string>>;
  // Codes pays FIPS (ceux de la carte) où l'annonce s'affiche ; absent = partout.
  countries?: string[];
  // Période de la campagne (dates ISO, incluses).
  from?: string;
  until?: string;
};

export const SPONSORS: Sponsor[] = [
  // Exemple :
  // {
  //   id: "journal-local-2026-11",
  //   name: "Le Journal",
  //   url: "https://example.org/?utm_source=cortege",
  //   text: { fr: "L'actualité sociale de votre région, chaque matin.", en: "Your region's labour news, every morning." },
  //   countries: ["FR", "BE"],
  //   from: "2026-11-01",
  //   until: "2026-11-30",
  // },
];

export function sponsorText(s: Sponsor, locale: Locale): string {
  return s.text[locale] ?? s.text.fr ?? s.text.en ?? "";
}

// Annonce à montrer pour le pays affiché (FIPS, ou null pour le monde entier).
// Une annonce ciblée sur ce pays passe avant une annonce sans ciblage.
export function pickSponsor(country: string | null, now = new Date()): Sponsor | null {
  const day = now.toISOString().slice(0, 10);
  const active = SPONSORS.filter((s) => (!s.from || s.from <= day) && (!s.until || day <= s.until));
  return (
    (country && active.find((s) => s.countries?.includes(country))) ||
    active.find((s) => !s.countries?.length) ||
    null
  );
}

export function findSponsor(id: string): Sponsor | null {
  return SPONSORS.find((s) => s.id === id) ?? null;
}

// Clés des compteurs mensuels (affichages et clics), pour facturer les annonceurs.
export function adStatKey(id: string, kind: "views" | "clicks", now = new Date()): string {
  return `ads:${id}:${now.toISOString().slice(0, 7)}:${kind}`;
}
