import type { fr } from "./dictionaries/fr";

export type Plural = { one: string; other: string };

// Toutes les langues ont la forme du dictionnaire français.
export type Dictionary = typeof fr;
