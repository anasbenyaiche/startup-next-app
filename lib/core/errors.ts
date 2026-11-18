// Erreur attendue, identifiée par un code : les actions serveur la renvoient au
// navigateur comme { ok: false, error: code }, traduit là-bas. Toute autre erreur
// est une vraie panne et remonte telle quelle.
export class CodedError<C extends string = string> extends Error {
  constructor(public readonly code: C) {
    super(code);
    this.name = new.target.name;
  }
}
