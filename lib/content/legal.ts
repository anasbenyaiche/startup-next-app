// Informations légales de l'éditeur, lues dans les variables d'environnement pour
// ne pas écrire d'informations personnelles dans le code. Une valeur manquante
// s'affiche entre crochets sur les pages légales, pour qu'elle saute aux yeux.

function value(name: string, missing: string): { text: string; missing: boolean } {
  const v = process.env[name]?.trim();
  return v ? { text: v, missing: false } : { text: `[${missing}]`, missing: true };
}

export function legalInfo() {
  return {
    // Nom de la personne ou de la société qui édite le site.
    publisher: value("LEGAL_PUBLISHER", "LEGAL_PUBLISHER : nom de l'éditeur"),
    // Statut et immatriculation (« Particulier », « SAS au capital de…, RCS… »).
    status: value("LEGAL_STATUS", "LEGAL_STATUS : statut, SIREN ou RCS"),
    address: value("LEGAL_ADDRESS", "LEGAL_ADDRESS : adresse postale"),
    email: value("LEGAL_EMAIL", "LEGAL_EMAIL : adresse de contact"),
    director: value("LEGAL_DIRECTOR", "LEGAL_DIRECTOR : directeur de la publication"),
  };
}

export type LegalInfo = ReturnType<typeof legalInfo>;

// Hébergeur (obligatoire dans les mentions légales) : Vercel, où le site est déployé.
export const HOST = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  url: "https://vercel.com",
};

// Pages légales : identifiant dans l'adresse (/fr/legal/cookies…).
export const LEGAL_PAGES = ["mentions", "confidentialite", "cookies"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

// Date de dernière mise à jour des textes, affichée en tête de chaque page.
export const LEGAL_UPDATED = "2026-10-19";
