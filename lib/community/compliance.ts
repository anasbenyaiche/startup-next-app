// Vérification de conformité d'une annonce de manifestation, lancée à chaque
// publication puis chaque jour sur toutes les annonces (les règles évoluent).
// Fonction pure : elle ne lit rien d'autre que ce qu'on lui passe.
//
// Trois niveaux :
// - « block »  : l'annonce n'est pas publiée tant que le problème n'est pas corrigé ;
// - « review » : l'annonce attend la relecture d'un modérateur avant d'être visible ;
// - « info »   : publiée, avec une information pour l'organisateur et les lecteurs.

export const COMPLIANCE_VERSION = 1;

export type IssueLevel = "block" | "review" | "info";

export type IssueCode =
  | "required"
  | "tooLong"
  | "invalidPosition"
  | "pastDate"
  | "tooFar"
  | "endBeforeStart"
  | "longEvent"
  | "personalData"
  | "violence"
  | "aggressive"
  | "insecureLink"
  | "shortener"
  | "tooManyLinks"
  | "shouting"
  | "repeated"
  | "duplicate"
  | "notDeclared"
  | "localRules";

export type ComplianceIssue = { code: IssueCode; level: IssueLevel; field?: string };

export type ComplianceReport = {
  version: number;
  checkedAt: string;
  status: "ok" | "review" | "blocked";
  issues: ComplianceIssue[];
  // Règles vérifiées, réussies ou non : affichées comme une liste de contrôle.
  checked: IssueCode[];
};

export type AnnouncementInput = {
  title: string;
  description: string;
  city: string;
  meetingPoint: string;
  organizer: string | null;
  sourceUrl: string | null;
  country: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string | null;
  declared: boolean;
};

export const LIMITS = { title: 120, description: 2000, city: 80, meetingPoint: 200, organizer: 100, sourceUrl: 500 };
const MIN_TITLE = 5;
const MAX_DAYS_AHEAD = 365;
const LONG_EVENT_DAYS = 7;
const MAX_LINKS = 2;

// Données personnelles d'un tiers : à ne pas publier (RGPD). Le lien officiel suffit pour contacter.
const PERSONAL_DATA = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // adresse e-mail
  /\b0[1-9](?:[\s.-]?\d{2}){4}\b/, // téléphone au format national (06 12 34 56 78)
  /\+\d{1,3}(?:[\s.-]?\d){7,12}\b/, // téléphone au format international
  /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/, // IBAN
  /\b(?:\d[ -]?){13,19}\b/, // numéro de carte
];

// Appels explicites à la violence : bloqués. Racines en minuscules sans accents, dans les langues du site.
const VIOLENCE = [
  "molotov",
  "mort aux",
  "mort a ",
  "tuer les",
  "tuons",
  "bruler les",
  "brulons",
  "lyncher",
  "venez armes",
  "apportez des armes",
  "death to",
  "kill the",
  "burn them",
  "bring weapons",
  "muerte a",
  "matar a",
  "quemar a",
  "morte aos",
  "matar os",
  "tod den",
  "tötet",
  "totet",
  "waffen mitbringen",
  "الموت ل",
  "اقتلوا",
  "احرقوا",
];

// Vocabulaire agressif ou ambigu : relu par un modérateur avant publication.
const AGGRESSIVE = [
  "casser",
  "cassons",
  "tout bruler",
  "emeute",
  "en decoudre",
  "black bloc",
  "riot",
  "smash",
  "destroy",
  "disturbios",
  "destruir",
  "quebrar",
  "krawall",
  "zerstören",
  "zerstoren",
  "شغب",
  "تخريب",
];

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly", "shorturl.at"];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

export function checkAnnouncement(
  a: AnnouncementInput,
  context: { now?: number; sameAuthor?: { title: string; startsAt: string }[] } = {},
): ComplianceReport {
  const now = context.now ?? Date.now();
  const issues: ComplianceIssue[] = [];
  const add = (code: IssueCode, level: IssueLevel, field?: string) => {
    if (!issues.some((i) => i.code === code && i.field === field)) issues.push({ code, level, field });
  };
  const texts: [string, string][] = [
    ["title", a.title],
    ["description", a.description],
    ["meetingPoint", a.meetingPoint],
    ["organizer", a.organizer ?? ""],
  ];

  // 1. Champs obligatoires et longueurs.
  if (a.title.trim().length < MIN_TITLE) add("required", "block", "title");
  if (!a.city.trim()) add("required", "block", "city");
  if (!a.meetingPoint.trim()) add("required", "block", "meetingPoint");
  if (!a.country) add("required", "block", "country");
  for (const [field, max] of Object.entries(LIMITS)) {
    const value = (a as unknown as Record<string, string | null>)[field] ?? "";
    if (value.length > max) add("tooLong", "block", field);
  }

  // 2. Position du point de rendez-vous.
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng) || Math.abs(a.lat) > 90 || Math.abs(a.lng) > 180) {
    add("invalidPosition", "block", "position");
  }

  // 3. Dates : à venir, dans l'année, fin après le début.
  const start = Date.parse(a.startsAt);
  const end = a.endsAt ? Date.parse(a.endsAt) : null;
  if (!Number.isFinite(start)) add("required", "block", "startsAt");
  else {
    if (start < now - 3600_000) add("pastDate", "block", "startsAt");
    if (start > now + MAX_DAYS_AHEAD * 86_400_000) add("tooFar", "block", "startsAt");
    if (end !== null) {
      if (!Number.isFinite(end) || end <= start) add("endBeforeStart", "block", "endsAt");
      else if (end - start > LONG_EVENT_DAYS * 86_400_000) add("longEvent", "review", "endsAt");
    }
  }

  // 4. Contenu : données personnelles, violence, liens, spam.
  for (const [field, text] of texts) {
    if (!text) continue;
    const withoutUrls = text.replace(URL_RE, " ");
    if (PERSONAL_DATA.some((re) => re.test(withoutUrls))) add("personalData", "block", field);
    const folded = ` ${fold(text).replace(/\s+/g, " ")} `;
    if (VIOLENCE.some((w) => folded.includes(w))) add("violence", "block", field);
    else if (AGGRESSIVE.some((w) => folded.includes(w))) add("aggressive", "review", field);
    const letters = text.replace(/[^\p{L}]/gu, "");
    if (letters.length >= 10 && letters.replace(/[^\p{Lu}]/gu, "").length / letters.length > 0.6) {
      add("shouting", "review", field);
    }
    if (/(.)\1{5,}/u.test(text)) add("repeated", "review", field);
  }
  const links = [...(a.description.match(URL_RE) ?? []), ...(a.sourceUrl ? [a.sourceUrl] : [])];
  if ((a.description.match(URL_RE) ?? []).length > MAX_LINKS) add("tooManyLinks", "review", "description");
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      add("insecureLink", "block", link === a.sourceUrl ? "sourceUrl" : "description");
      continue;
    }
    const field = link === a.sourceUrl ? "sourceUrl" : "description";
    if (url.protocol !== "https:") add("insecureLink", "block", field);
    const host = url.hostname.replace(/^www\./, "");
    if (SHORTENERS.includes(host)) add("shortener", "review", field);
  }

  // 5. Doublon : même titre, même jour, même auteur.
  const day = (iso: string) => iso.slice(0, 10);
  if (
    Number.isFinite(start) &&
    (context.sameAuthor ?? []).some((o) => fold(o.title).trim() === fold(a.title).trim() && day(o.startsAt) === day(a.startsAt))
  ) {
    add("duplicate", "block", "title");
  }

  // 6. Cadre légal. En France, une manifestation sur la voie publique se déclare
  // en mairie ou en préfecture 3 à 15 jours avant (code de la sécurité intérieure, art. L211-1 et L211-2).
  if (a.country === "FR" && !a.declared) add("notDeclared", "info", "declared");
  if (a.country && a.country !== "FR") add("localRules", "info", "declared");

  const status = issues.some((i) => i.level === "block")
    ? "blocked"
    : issues.some((i) => i.level === "review")
      ? "review"
      : "ok";
  return {
    version: COMPLIANCE_VERSION,
    checkedAt: new Date(now).toISOString(),
    status,
    issues,
    checked: ["required", "invalidPosition", "pastDate", "personalData", "violence", "insecureLink", "shouting", "duplicate", "notDeclared"],
  };
}
