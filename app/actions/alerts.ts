"use server";

import { currentAccount } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { AlertError, cancelAlert, createAlert, flagAlert, seedDemoAlerts, type SosAlert } from "@/lib/alerts";

// Seuls les « reporters » envoient une alerte : un compte connecté dont l'adresse
// e-mail est vérifiée. Le compte n'est jamais publié avec l'alerte.

export type AlertResult<T> = { ok: true; value: T } | { ok: false; error: AlertError["code"] | "signIn" };

async function run<T>(fn: (userId: string) => Promise<T>): Promise<AlertResult<T>> {
  const account = await currentAccount();
  if (!account?.verifiedAt) return { ok: false, error: "signIn" };
  try {
    return { ok: true, value: await fn(account.id) };
  } catch (err) {
    if (err instanceof AlertError) return { ok: false, error: err.code };
    throw err;
  }
}

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
  if (!(await isAdmin())) return { ok: false, error: "forbidden" };
  return run(() => seedDemoAlerts(lat, lng));
}
