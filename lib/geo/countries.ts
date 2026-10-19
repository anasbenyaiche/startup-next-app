// Correspondance FIPS 10-4 (codes pays de GDELT) vers ISO 3166-1 alpha-2
// (codes des navigateurs, de Intl.DisplayNames et des en-têtes de géolocalisation).
// Source : mysociety/gaze, fips-10-4-to-iso-country-codes.csv (Guernesey, Jersey et Man corrigés).
export const FIPS_TO_ISO: Record<string, string> = {
  AF: "AF", AL: "AL", AG: "DZ", AQ: "AS", AN: "AD", AO: "AO", AV: "AI", AY: "AQ", AC: "AG", AR: "AR",
  AM: "AM", AA: "AW", AT: "AU", AS: "AU", AU: "AT", AJ: "AZ", BF: "BS", BA: "BH", FQ: "UM", BG: "BD",
  BB: "BB", BS: "RE", BO: "BY", BE: "BE", BH: "BZ", BN: "BJ", BD: "BM", BT: "BT", BL: "BO", BK: "BA",
  BC: "BW", BV: "BV", BR: "BR", IO: "IO", BX: "BN", BU: "BG", UV: "BF", BM: "MM", BY: "BI", CB: "KH",
  CM: "CM", CA: "CA", CV: "CV", CJ: "KY", CT: "CF", CD: "TD", CI: "CL", CH: "CN", KT: "CX", IP: "PF",
  CK: "CC", CO: "CO", CN: "KM", CG: "CD", CF: "CG", CW: "CK", CR: "AU", CS: "CR", IV: "CI", HR: "HR",
  CU: "CU", UC: "CW", CY: "CY", EZ: "CZ", DA: "DK", DJ: "DJ", DO: "DM", DR: "DO", EC: "EC", EG: "EG",
  ES: "SV", EK: "GQ", ER: "ER", EN: "EE", ET: "ET", EU: "RE", FK: "FK", FO: "FO", FJ: "FJ", FI: "FI",
  FR: "FR", FG: "GF", FP: "PF", FS: "TF", GB: "GA", GA: "GM", GZ: "PS", GG: "GE", GM: "DE", GH: "GH",
  GI: "GI", GO: "RE", GR: "GR", GL: "GL", GJ: "GD", GP: "GP", GQ: "GU", GT: "GT", GK: "GG", GV: "GN",
  PU: "GW", GY: "GY", HA: "HT", HM: "HM", HO: "HN", HK: "HK", HQ: "UM", HU: "HU", IC: "IS", IN: "IN",
  ID: "ID", IR: "IR", IZ: "IQ", EI: "IE", IM: "IM", IS: "IL", IT: "IT", JM: "JM", JN: "SJ", JA: "JP",
  DQ: "UM", JE: "JE", JQ: "UM", JO: "JO", JU: "RE", KZ: "KZ", KE: "KE", KQ: "UM", KR: "KI", KN: "KP",
  KS: "KR", KU: "KW", KG: "KG", LA: "LA", LG: "LV", LE: "LB", LT: "LS", LI: "LR", LY: "LY", LS: "LI",
  LH: "LT", LU: "LU", MC: "MO", MK: "MK", MA: "MG", MI: "MW", MY: "MY", MV: "MV", ML: "ML", MT: "MT",
  RM: "MH", MB: "MQ", MR: "MR", MP: "MU", MF: "YT", MX: "MX", FM: "FM", MQ: "UM", MD: "MD", MN: "MC",
  MG: "MN", MJ: "ME", MH: "MS", MO: "MA", MZ: "MZ", WA: "NA", NR: "NR", BQ: "UM", NP: "NP",
  NL: "NL", NC: "NC", NZ: "NZ", NU: "NI", NG: "NE", NI: "NG", NE: "NU", NF: "NF", CQ: "MP", NO: "NO",
  MU: "OM", PK: "PK", PS: "PW", LQ: "UM", PM: "PA", PP: "PG", PA: "PY", PE: "PE", RP: "PH", PC: "PN",
  PL: "PL", PO: "PT", RQ: "PR", QA: "QA", RE: "RE", RO: "RO", RS: "RU", RW: "RW", TB: "BL", SH: "SH",
  SC: "KN", ST: "LC", RN: "MF", SB: "PM", VC: "VC", WS: "WS", SM: "SM", TP: "ST", SA: "SA", SG: "SN",
  RI: "RS", SE: "SC", SL: "SL", SN: "SG", NN: "SX", LO: "SK", SI: "SI", BP: "SB", SO: "SO", SF: "ZA",
  SX: "GS", OD: "SS", SP: "ES", CE: "LK", SU: "SD", NS: "SR", SV: "SJ", WZ: "SZ", SW: "SE", SZ: "CH",
  SY: "SY", TW: "TW", TI: "TJ", TZ: "TZ", TH: "TH", TT: "TL", TO: "TG", TL: "TK", TN: "TO", TD: "TT",
  TE: "UM", TS: "TN", TU: "TR", TX: "TM", TK: "TC", TV: "TV", UG: "UG", UP: "UA", AE: "AE", UK: "GB",
  US: "US", UY: "UY", UZ: "UZ", NH: "VU", VT: "VA", VE: "VE", VM: "VN", VI: "VG", VQ: "VI", WQ: "UM",
  WF: "WF", WE: "PS", WI: "EH", YM: "YE", ZA: "ZM", ZI: "ZW",
};

// Plusieurs codes FIPS désignent le même pays ISO (îles éparses, territoires) :
// on fixe celui du territoire principal.
const PREFERRED_FIPS: Record<string, string> = { AU: "AS", GB: "UK", RE: "RE", PF: "FP", PS: "WE", MM: "BM", SJ: "SV" };

const ISO_TO_FIPS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(FIPS_TO_ISO).map(([fips, iso]) => [iso, fips])),
  ...PREFERRED_FIPS,
};

export function fipsToIso(fips: string): string | null {
  return FIPS_TO_ISO[fips] ?? null;
}

export function isoToFips(iso: string): string | null {
  return ISO_TO_FIPS[iso.toUpperCase()] ?? null;
}
