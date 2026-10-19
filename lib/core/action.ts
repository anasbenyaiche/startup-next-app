import "server-only";
import { CodedError } from "@/lib/core/errors";

// Résultat d'une action serveur : la valeur, ou un code d'erreur que le navigateur traduit.
export type ActionResult<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

// Exécute une action au nom d'un utilisateur connecté. Sans utilisateur : « signIn ».
// Une CodedError (refus attendu : limite atteinte, contenu introuvable…) devient un
// code ; toute autre erreur est une panne et remonte.
export async function runForUser<T, E extends string>(
  userId: string | null | undefined,
  fn: (userId: string) => Promise<T>,
): Promise<ActionResult<T, E | "signIn">> {
  if (!userId) return { ok: false, error: "signIn" };
  try {
    return { ok: true, value: await fn(userId) };
  } catch (err) {
    if (err instanceof CodedError) return { ok: false, error: err.code as E };
    throw err;
  }
}
