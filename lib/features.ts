// Fonctions en préparation, masquées tant que la variable n'est pas à « 1 ».
// Les annonces de manifestations (page « Créer ») : NEXT_PUBLIC_FEATURE_ANNOUNCEMENTS=1.
export const ANNOUNCEMENTS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_ANNOUNCEMENTS === "1";
