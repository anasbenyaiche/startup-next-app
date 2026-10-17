import type { Family } from "@/lib/protest-types";

export { TYPE_FAMILY } from "@/lib/protest-types";

// Trois teintes validées (daltonisme compris) pour que n'importe quels points
// voisins sur la carte restent distinguables. Le rose reste réservé à la marque.
export const FAMILY_COLORS: Record<Family, string> = {
  peaceful: "#2a78d6",
  strike: "#eda100",
  violent: "#e34948",
};

export const FAMILY_ORDER: Family[] = ["peaceful", "strike", "violent"];

// Types CAMEO rangés par famille, dans l'ordre des filtres.
export const TYPES_BY_FAMILY: Record<Family, string[]> = {
  peaceful: ["141", "140"],
  strike: ["143", "142", "144"],
  violent: ["145"],
};
