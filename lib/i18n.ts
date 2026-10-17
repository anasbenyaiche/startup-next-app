import { FIPS_TO_ISO } from "./countries";

export const LOCALES = ["fr", "en", "es", "pt", "de", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lang";

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  ar: "العربية",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

type Plural = { one: string; other: string };

const fr = {
  meta: {
    description: "Les manifestations du monde entier sur une carte, mise à jour toutes les 15 minutes.",
    mapTitle: "Carte des manifestations",
  },
  nav: {
    home: "Cortège, accueil",
    map: "Carte",
    create: "Créer",
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    language: "Langue",
  },
  home: {
    banner: "Qui manifeste, où, maintenant.",
    intro:
      "Cortège repère les manifestations, grèves et blocages signalés par la presse du monde entier, et les place sur une carte mise à jour toutes les 15 minutes.",
    cta: "Ouvrir la carte",
    sourceNote:
      "Les données viennent de GDELT, qui analyse les articles de presse en continu. Une manifestation peu couverte par les médias peut ne pas apparaître.",
    liveTitle: "En ce moment",
    unreachable: "Les données de la presse sont injoignables pour l'instant. Réessayez dans quelques minutes.",
    loading: "Chargement des 6 dernières heures…",
    empty: "Aucune manifestation signalée ces 6 dernières heures.",
    updatedAt: (time: string) => `Mis à jour à ${time}`,
    yourCountry: "Votre pays :",
    nothingInYourCountry: "rien de signalé ces 6 dernières heures",
  },
  map: {
    world: "Le monde",
    country: "Pays",
    allCountries: "Tous les pays",
    noEvents: "aucun événement",
    period: "Période",
    types: "Types",
    live: (time: string) => `En direct, mis à jour à ${time}`,
    interrupted: "Mise à jour interrompue",
    connecting: "Connexion au flux de presse…",
    feedDown: (err: string) => `Le flux de presse ne répond pas (${err}). La carte réessaiera dans 15 minutes.`,
    reading: "Lecture des articles de presse… jusqu'à une minute pour 72 h.",
    protests: { one: "manifestation", other: "manifestations" } as Plural,
    places: { one: "lieu", other: "lieux" } as Plural,
    countries: { one: "pays", other: "pays" } as Plural,
    in: "dans",
    refreshing: "(actualisation)",
    missingSlots: (n: number) => `${n} relevé(s) de 15 min manquant(s) sur la période.`,
    topCountries: "Pays les plus actifs",
    topPlaces: "Lieux les plus actifs",
    seeWorld: "Voir le monde",
    mentions: { one: "mention", other: "mentions" } as Plural,
    latest: "Dernier signalement",
  },
  types: {
    "141": "Manifestation, rassemblement",
    "143": "Grève, boycott",
    "144": "Blocage, occupation",
    "145": "Émeute, violences",
    "142": "Grève de la faim",
    "140": "Autre protestation",
  } as Record<string, string>,
};

export type Dictionary = typeof fr;

const en: Dictionary = {
  meta: {
    description: "Protests around the world on one map, updated every 15 minutes.",
    mapTitle: "Protest map",
  },
  nav: { home: "Cortège, home", map: "Map", create: "Create", signIn: "Sign in", signOut: "Sign out", language: "Language" },
  home: {
    banner: "Who is protesting, where, right now.",
    intro:
      "Cortège picks up the protests, strikes and blockades reported by the press worldwide and puts them on a map updated every 15 minutes.",
    cta: "Open the map",
    sourceNote:
      "Data comes from GDELT, which reads news articles around the clock. A protest the media barely covered may be missing.",
    liveTitle: "Right now",
    unreachable: "News data can't be reached right now. Try again in a few minutes.",
    loading: "Loading the last 6 hours…",
    empty: "No protests reported in the last 6 hours.",
    updatedAt: (time) => `Updated at ${time}`,
    yourCountry: "Your country:",
    nothingInYourCountry: "nothing reported in the last 6 hours",
  },
  map: {
    world: "The world",
    country: "Country",
    allCountries: "All countries",
    noEvents: "no events",
    period: "Period",
    types: "Types",
    live: (time) => `Live, updated at ${time}`,
    interrupted: "Updates paused",
    connecting: "Connecting to the news feed…",
    feedDown: (err) => `The news feed isn't responding (${err}). The map will retry in 15 minutes.`,
    reading: "Reading news articles… up to a minute for 72 h.",
    protests: { one: "protest", other: "protests" },
    places: { one: "place", other: "places" },
    countries: { one: "country", other: "countries" },
    in: "in",
    refreshing: "(refreshing)",
    missingSlots: (n) => `${n} missing 15-minute batch(es) in this period.`,
    topCountries: "Most active countries",
    topPlaces: "Most active places",
    seeWorld: "See the world",
    mentions: { one: "mention", other: "mentions" },
    latest: "Latest report",
  },
  types: {
    "141": "Demonstration, rally",
    "143": "Strike, boycott",
    "144": "Blockade, occupation",
    "145": "Riot, violence",
    "142": "Hunger strike",
    "140": "Other protest",
  },
};

const es: Dictionary = {
  meta: {
    description: "Las protestas de todo el mundo en un mapa, actualizado cada 15 minutos.",
    mapTitle: "Mapa de protestas",
  },
  nav: { home: "Cortège, inicio", map: "Mapa", create: "Crear", signIn: "Iniciar sesión", signOut: "Cerrar sesión", language: "Idioma" },
  home: {
    banner: "Quién protesta, dónde, ahora.",
    intro:
      "Cortège detecta las manifestaciones, huelgas y bloqueos que recoge la prensa de todo el mundo y los sitúa en un mapa actualizado cada 15 minutos.",
    cta: "Abrir el mapa",
    sourceNote:
      "Los datos vienen de GDELT, que analiza artículos de prensa sin parar. Una protesta con poca cobertura mediática puede no aparecer.",
    liveTitle: "Ahora mismo",
    unreachable: "Los datos de prensa no están disponibles ahora. Vuelve a intentarlo en unos minutos.",
    loading: "Cargando las últimas 6 horas…",
    empty: "Ninguna protesta registrada en las últimas 6 horas.",
    updatedAt: (time) => `Actualizado a las ${time}`,
    yourCountry: "Tu país:",
    nothingInYourCountry: "nada registrado en las últimas 6 horas",
  },
  map: {
    world: "El mundo",
    country: "País",
    allCountries: "Todos los países",
    noEvents: "sin eventos",
    period: "Periodo",
    types: "Tipos",
    live: (time) => `En directo, actualizado a las ${time}`,
    interrupted: "Actualización interrumpida",
    connecting: "Conectando con el flujo de prensa…",
    feedDown: (err) => `El flujo de prensa no responde (${err}). El mapa lo reintentará en 15 minutos.`,
    reading: "Leyendo artículos de prensa… hasta un minuto para 72 h.",
    protests: { one: "protesta", other: "protestas" },
    places: { one: "lugar", other: "lugares" },
    countries: { one: "país", other: "países" },
    in: "en",
    refreshing: "(actualizando)",
    missingSlots: (n) => `Faltan ${n} lote(s) de 15 min en este periodo.`,
    topCountries: "Países más activos",
    topPlaces: "Lugares más activos",
    seeWorld: "Ver el mundo",
    mentions: { one: "mención", other: "menciones" },
    latest: "Último aviso",
  },
  types: {
    "141": "Manifestación, concentración",
    "143": "Huelga, boicot",
    "144": "Bloqueo, ocupación",
    "145": "Disturbios, violencia",
    "142": "Huelga de hambre",
    "140": "Otra protesta",
  },
};

const pt: Dictionary = {
  meta: {
    description: "Os protestos do mundo inteiro num mapa, atualizado a cada 15 minutos.",
    mapTitle: "Mapa de protestos",
  },
  nav: { home: "Cortège, início", map: "Mapa", create: "Criar", signIn: "Entrar", signOut: "Sair", language: "Idioma" },
  home: {
    banner: "Quem protesta, onde, agora.",
    intro:
      "O Cortège identifica as manifestações, greves e bloqueios noticiados pela imprensa do mundo inteiro e coloca-os num mapa atualizado a cada 15 minutos.",
    cta: "Abrir o mapa",
    sourceNote:
      "Os dados vêm do GDELT, que analisa notícias continuamente. Um protesto com pouca cobertura mediática pode não aparecer.",
    liveTitle: "Neste momento",
    unreachable: "Os dados da imprensa estão indisponíveis agora. Tente novamente dentro de alguns minutos.",
    loading: "A carregar as últimas 6 horas…",
    empty: "Nenhum protesto noticiado nas últimas 6 horas.",
    updatedAt: (time) => `Atualizado às ${time}`,
    yourCountry: "O seu país:",
    nothingInYourCountry: "nada noticiado nas últimas 6 horas",
  },
  map: {
    world: "O mundo",
    country: "País",
    allCountries: "Todos os países",
    noEvents: "sem eventos",
    period: "Período",
    types: "Tipos",
    live: (time) => `Ao vivo, atualizado às ${time}`,
    interrupted: "Atualização interrompida",
    connecting: "A ligar ao fluxo de notícias…",
    feedDown: (err) => `O fluxo de notícias não responde (${err}). O mapa tentará de novo dentro de 15 minutos.`,
    reading: "A ler notícias… até um minuto para 72 h.",
    protests: { one: "protesto", other: "protestos" },
    places: { one: "local", other: "locais" },
    countries: { one: "país", other: "países" },
    in: "em",
    refreshing: "(a atualizar)",
    missingSlots: (n) => `Faltam ${n} lote(s) de 15 min neste período.`,
    topCountries: "Países mais ativos",
    topPlaces: "Locais mais ativos",
    seeWorld: "Ver o mundo",
    mentions: { one: "menção", other: "menções" },
    latest: "Última notícia",
  },
  types: {
    "141": "Manifestação, concentração",
    "143": "Greve, boicote",
    "144": "Bloqueio, ocupação",
    "145": "Motim, violência",
    "142": "Greve de fome",
    "140": "Outro protesto",
  },
};

const de: Dictionary = {
  meta: {
    description: "Proteste auf der ganzen Welt auf einer Karte, alle 15 Minuten aktualisiert.",
    mapTitle: "Protestkarte",
  },
  nav: { home: "Cortège, Startseite", map: "Karte", create: "Erstellen", signIn: "Anmelden", signOut: "Abmelden", language: "Sprache" },
  home: {
    banner: "Wer protestiert, wo, jetzt.",
    intro:
      "Cortège erfasst Demonstrationen, Streiks und Blockaden, über die die Presse weltweit berichtet, und zeigt sie auf einer Karte, die alle 15 Minuten aktualisiert wird.",
    cta: "Karte öffnen",
    sourceNote:
      "Die Daten stammen von GDELT, das laufend Presseartikel auswertet. Ein Protest, über den kaum berichtet wurde, kann fehlen.",
    liveTitle: "Gerade jetzt",
    unreachable: "Die Pressedaten sind gerade nicht erreichbar. Versuchen Sie es in ein paar Minuten erneut.",
    loading: "Die letzten 6 Stunden werden geladen…",
    empty: "In den letzten 6 Stunden wurden keine Proteste gemeldet.",
    updatedAt: (time) => `Aktualisiert um ${time}`,
    yourCountry: "Ihr Land:",
    nothingInYourCountry: "in den letzten 6 Stunden nichts gemeldet",
  },
  map: {
    world: "Die Welt",
    country: "Land",
    allCountries: "Alle Länder",
    noEvents: "keine Ereignisse",
    period: "Zeitraum",
    types: "Arten",
    live: (time) => `Live, aktualisiert um ${time}`,
    interrupted: "Aktualisierung unterbrochen",
    connecting: "Verbindung zum Pressefeed…",
    feedDown: (err) => `Der Pressefeed antwortet nicht (${err}). Die Karte versucht es in 15 Minuten erneut.`,
    reading: "Presseartikel werden gelesen… bis zu einer Minute für 72 h.",
    protests: { one: "Protest", other: "Proteste" },
    places: { one: "Ort", other: "Orten" },
    countries: { one: "Land", other: "Ländern" },
    in: "an",
    refreshing: "(wird aktualisiert)",
    missingSlots: (n) => `${n} fehlende 15-Minuten-Lieferung(en) in diesem Zeitraum.`,
    topCountries: "Aktivste Länder",
    topPlaces: "Aktivste Orte",
    seeWorld: "Ganze Welt zeigen",
    mentions: { one: "Erwähnung", other: "Erwähnungen" },
    latest: "Letzte Meldung",
  },
  types: {
    "141": "Demonstration, Kundgebung",
    "143": "Streik, Boykott",
    "144": "Blockade, Besetzung",
    "145": "Ausschreitungen, Gewalt",
    "142": "Hungerstreik",
    "140": "Anderer Protest",
  },
};

// Les pluriels arabes ont six formes : on emploie des tournures « libellé : nombre » neutres.
const ar: Dictionary = {
  meta: {
    description: "الاحتجاجات في العالم كله على خريطة واحدة، تُحدَّث كل 15 دقيقة.",
    mapTitle: "خريطة الاحتجاجات",
  },
  nav: { home: "Cortège، الصفحة الرئيسية", map: "الخريطة", create: "إنشاء", signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", language: "اللغة" },
  home: {
    banner: "من يحتج، وأين، الآن.",
    intro:
      "يرصد Cortège المظاهرات والإضرابات وعمليات الإغلاق التي تنقلها الصحافة في العالم كله، ويضعها على خريطة تُحدَّث كل 15 دقيقة.",
    cta: "افتح الخريطة",
    sourceNote:
      "تأتي البيانات من GDELT الذي يحلل المقالات الصحفية باستمرار. قد لا يظهر احتجاج لم تغطه وسائل الإعلام بما يكفي.",
    liveTitle: "الآن",
    unreachable: "بيانات الصحافة غير متاحة حاليًا. أعد المحاولة بعد بضع دقائق.",
    loading: "جارٍ تحميل آخر 6 ساعات…",
    empty: "لم يُرصد أي احتجاج خلال آخر 6 ساعات.",
    updatedAt: (time) => `آخر تحديث ${time}`,
    yourCountry: "بلدك:",
    nothingInYourCountry: "لم يُرصد شيء خلال آخر 6 ساعات",
  },
  map: {
    world: "العالم",
    country: "البلد",
    allCountries: "كل البلدان",
    noEvents: "لا أحداث",
    period: "الفترة",
    types: "الأنواع",
    live: (time) => `مباشر، آخر تحديث ${time}`,
    interrupted: "توقف التحديث",
    connecting: "جارٍ الاتصال بتدفق الأخبار…",
    feedDown: (err) => `تدفق الأخبار لا يستجيب (${err}). ستعيد الخريطة المحاولة بعد 15 دقيقة.`,
    reading: "جارٍ قراءة المقالات… قد يستغرق ذلك دقيقة لفترة 72 ساعة.",
    protests: { one: "احتجاج", other: "احتجاجات" },
    places: { one: "مكان", other: "أماكن" },
    countries: { one: "بلد", other: "بلدان" },
    in: "في",
    refreshing: "(جارٍ التحديث)",
    missingSlots: (n) => `دفعات ناقصة (15 دقيقة): ${n}`,
    topCountries: "البلدان الأكثر نشاطًا",
    topPlaces: "الأماكن الأكثر نشاطًا",
    seeWorld: "عرض العالم",
    mentions: { one: "إشارة", other: "إشارات" },
    latest: "آخر رصد",
  },
  types: {
    "141": "مظاهرة، تجمع",
    "143": "إضراب، مقاطعة",
    "144": "إغلاق، اعتصام",
    "145": "أعمال شغب، عنف",
    "142": "إضراب عن الطعام",
    "140": "احتجاج آخر",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en, es, pt, de, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function plural(locale: Locale, n: number, forms: Plural): string {
  return new Intl.PluralRules(locale).select(n) === "one" ? forms.one : forms.other;
}

// Nom du pays dans la langue du visiteur ; repli sur le nom anglais fourni par GDELT.
export function countryName(locale: Locale, fips: string, fallback: string): string {
  const iso = FIPS_TO_ISO[fips];
  if (!iso) return fallback;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(iso) ?? fallback;
  } catch {
    return fallback;
  }
}

// Langue par défaut selon le pays (ISO) du visiteur. Les pays absents passent à l'anglais.
// Le Maghreb reste en français : c'est la langue du produit, et l'arabe reste à un clic.
const COUNTRY_LOCALE: Record<string, Locale> = {};
const assign = (locale: Locale, codes: string) => codes.split(" ").forEach((c) => (COUNTRY_LOCALE[c] = locale));
assign("fr", "FR BE LU MC SN CI ML BF NE TG BJ GN CM GA CG CD CF TD MG HT RE GP MQ GF YT NC PF PM WF MA DZ TN MR DJ KM BI");
assign("es", "ES MX AR CO PE VE CL EC GT CU BO DO HN PY SV NI CR PA UY PR GQ");
assign("pt", "PT BR AO MZ CV GW ST TL");
assign("de", "DE AT CH LI");
assign("ar", "SA AE EG IQ JO KW LB LY OM QA SY YE BH SD PS");

export function localeForCountry(iso: string | null): Locale | null {
  if (!iso) return null;
  return COUNTRY_LOCALE[iso.toUpperCase()] ?? "en";
}
