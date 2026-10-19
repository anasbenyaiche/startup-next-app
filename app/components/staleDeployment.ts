// Une action serveur introuvable signifie que la page a été chargée avant un
// redéploiement : le navigateur garde l'ancien code, dont les actions n'existent plus.
// On recharge la page pour obtenir la nouvelle version au lieu d'échouer en silence.
export function isStaleDeployment(err: unknown): boolean {
  return err instanceof Error && (err.name === "UnrecognizedActionError" || /Server Action .* was not found/i.test(err.message));
}

export async function runAction<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (err) {
    if (isStaleDeployment(err)) {
      window.location.reload();
      return undefined;
    }
    throw err;
  }
}
