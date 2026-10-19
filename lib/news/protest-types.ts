// Types d'action (codes CAMEO 140 à 145) et leurs familles, partagés entre le
// serveur et le navigateur.
export const PROTEST_TYPES = ["140", "141", "142", "143", "144", "145"] as const;

// Trois familles pour la carte : au-delà de trois teintes, les couleurs ne restent
// pas distinguables pour tout le monde quand n'importe quels points se côtoient.
export type Family = "peaceful" | "strike" | "violent";
export const TYPE_FAMILY: Record<string, Family> = {
  "140": "peaceful",
  "141": "peaceful",
  "142": "strike",
  "143": "strike",
  "144": "strike",
  "145": "violent",
};
