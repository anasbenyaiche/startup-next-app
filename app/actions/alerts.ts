"use server";

import { currentAccount } from "@/auth";
import { isModerator } from "@/lib/users/admin";
import { cancelAlert, createAlert, flagAlert, seedDemoAlerts, type AlertError, type SosAlert } from "@/lib/community/alerts";
import { runForUser, type ActionResult } from "@/lib/core/action";

// Seuls les « reporters » envoient une alerte : un compte connecté dont l'adresse
// e-mail est vérifiée. Le compte n'est jamais publié avec l'alerte.

export type AlertResult<T> = ActionResult<T, AlertError["code"] | "signIn">;

// Compte vérifié exigé : un compte dont l'adresse n'est pas vérifiée compte comme non connecté.
const run = async <T>(fn: (userId: string) => Promise<T>): Promise<AlertResult<T>> => {
  const account = await currentAccount();
  return runForUser<T, AlertError["code"]>(account?.verifiedAt ? account.id : null, fn);
};

export async function sendAlert(input: { kind: string; lat: number; lng: number }): Promise<AlertResult<SosAlert>> {
  return run((id) => createAlert(id, input));
}

export async function withdrawAlert(alertId: string): Promise<AlertResult<null>> {
  return run((id) => cancelAlert(id, String(alertId)).then(() => null));
}

export async function reportFalseAlert(alertId: string): Promise<AlertResult<SosAlert | null>> {
  return run((id) => flagAlert(id, String(alertId)));
}

export async function showDemoAlerts(lat: number, lng: number): Promise<AlertResult<SosAlert[]>> {
  if (!(await isModerator())) return { ok: false, error: "forbidden" };
  return run(() => seedDemoAlerts(lat, lng));
}
