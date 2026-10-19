import "server-only";
import { createHmac } from "crypto";

// Empreinte d'un compte pour les contenus publics (signalements, alertes, annonces) :
// elle sert à limiter les envois et à empêcher les doubles votes, sans jamais
// permettre de retrouver le compte à partir du contenu publié.
export function authorHash(userId: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "cortege").update(`report:${userId}`).digest("hex").slice(0, 24);
}
