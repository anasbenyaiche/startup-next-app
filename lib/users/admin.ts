import "server-only";
import { currentAccount } from "@/auth";
import type { Account } from "@/lib/users/accounts";
import { storeGet, storeSet } from "@/lib/core/store";

// Rôles de l'équipe :
// - administrateur : gère les comptes (rôles, bannissements, suppressions) et modère ;
// - modérateur : modère les contenus (alertes SOS, signalements, couvre-feux, annonces).
// Les adresses de ADMIN_EMAILS (séparées par des virgules) sont administratrices d'office,
// et ne peuvent pas être rétrogradées depuis l'interface. Un rôle n'a d'effet que sur un
// compte à l'adresse vérifiée et non banni.

export type StaffRole = "admin" | "moderator";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isEnvAdmin = (account: Pick<Account, "email">) => adminEmails().includes(account.email.toLowerCase());

export function roleOf(account: Account | null): StaffRole | null {
  if (!account?.verifiedAt || account.bannedAt) return null;
  if (isEnvAdmin(account)) return "admin";
  return account.role ?? null;
}

export async function currentRole(): Promise<StaffRole | null> {
  return roleOf(await currentAccount());
}

export async function isAdmin(): Promise<boolean> {
  return (await currentRole()) === "admin";
}

export async function isModerator(): Promise<boolean> {
  return (await currentRole()) !== null;
}

// --- Journal des actions de l'équipe -----------------------------------------

export type AuditEntry = { at: string; actor: string; action: string; target: string; detail?: string };

const AUDIT_KEY = "admin:audit:v1";
const AUDIT_MAX = 300;

export async function logAction(actor: Account, action: string, target: string, detail?: string): Promise<void> {
  const entries = (await storeGet<AuditEntry[]>(AUDIT_KEY)) ?? [];
  const entry: AuditEntry = { at: new Date().toISOString(), actor: actor.email, action, target, ...(detail ? { detail } : {}) };
  await storeSet(AUDIT_KEY, [entry, ...entries].slice(0, AUDIT_MAX));
}

export async function auditLog(limit = 60): Promise<AuditEntry[]> {
  return ((await storeGet<AuditEntry[]>(AUDIT_KEY)) ?? []).slice(0, limit);
}
