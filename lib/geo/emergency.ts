// Numéros d'urgence par pays (code ISO), affichés dans « Stay safe » sur l'accueil.
// Le 112 fonctionne dans toute l'Union européenne ; ailleurs, seuls les pays listés
// ont des numéros, les autres voient un simple rappel.

export type EmergencyKind = "general" | "medical" | "police" | "fire";
export type EmergencyNumber = { number: string; kind: EmergencyKind };

const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "GR", "HU", "IE", "LV", "LT", "LU", "MT", "NL", "PL", "RO", "SK", "SI", "SE", "CH", "NO", "IS"];

const NUMBERS: Record<string, EmergencyNumber[]> = {
  FR: [
    { number: "112", kind: "general" },
    { number: "15", kind: "medical" },
    { number: "17", kind: "police" },
    { number: "18", kind: "fire" },
  ],
  DE: [
    { number: "112", kind: "general" },
    { number: "110", kind: "police" },
  ],
  ES: [{ number: "112", kind: "general" }],
  PT: [{ number: "112", kind: "general" }],
  IT: [{ number: "112", kind: "general" }],
  GB: [
    { number: "999", kind: "general" },
    { number: "112", kind: "general" },
  ],
  US: [{ number: "911", kind: "general" }],
  CA: [{ number: "911", kind: "general" }],
  MX: [{ number: "911", kind: "general" }],
  AR: [{ number: "911", kind: "general" }],
  BR: [
    { number: "190", kind: "police" },
    { number: "192", kind: "medical" },
    { number: "193", kind: "fire" },
  ],
  TN: [
    { number: "197", kind: "police" },
    { number: "190", kind: "medical" },
    { number: "198", kind: "fire" },
  ],
  MA: [
    { number: "19", kind: "police" },
    { number: "15", kind: "medical" },
  ],
  DZ: [
    { number: "17", kind: "police" },
    { number: "14", kind: "medical" },
  ],
  AU: [{ number: "000", kind: "general" }],
  ...Object.fromEntries(EU.map((c) => [c, [{ number: "112", kind: "general" as const }]])),
};

export function emergencyNumbers(iso: string | null): EmergencyNumber[] | null {
  return (iso && NUMBERS[iso.toUpperCase()]) || null;
}
