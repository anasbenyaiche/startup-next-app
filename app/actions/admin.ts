"use server";

import { revalidatePath } from "next/cache";
import { currentAccount } from "@/auth";
import { deleteAccount, getAccountById, markVerified, updateAccount, type Account } from "@/lib/users/accounts";
import { isEnvAdmin, logAction, roleOf } from "@/lib/users/admin";
import { removeAlert } from "@/lib/community/alerts";
import { deleteProfile } from "@/lib/users/profile";
import { removeReport } from "@/lib/community/reports";

// Actions de l'équipe. Le rôle est relu dans la base à chaque appel : un rôle retiré
// ou un compte banni n'a plus aucun pouvoir, même avec une page encore ouverte.

export type AdminResult = { ok: true } | { ok: false; error: "forbidden" | "self" | "protected" | "notFound" | "invalid" };

const PAGE = "/startup/moderate";

// Toutes les actions de cette page sont réservées aux administrateurs.
async function staff(): Promise<Account | null> {
  const me = await currentAccount();
  return me && roleOf(me) === "admin" ? me : null;
}

// Garde-fous communs aux actions sur un compte : pas sur soi-même, pas sur un
// administrateur défini par ADMIN_EMAILS.
async function target(me: Account, id: unknown): Promise<Account | AdminResult> {
  if (typeof id !== "string") return { ok: false, error: "invalid" };
  if (id === me.id) return { ok: false, error: "self" };
  const account = await getAccountById(id);
  if (!account) return { ok: false, error: "notFound" };
  if (isEnvAdmin(account)) return { ok: false, error: "protected" };
  return account;
}

const isResult = (x: Account | AdminResult): x is AdminResult => "ok" in x;

export async function setUserRole(id: string, role: "admin" | "moderator" | null): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  if (role !== null && role !== "admin" && role !== "moderator") return { ok: false, error: "invalid" };
  const account = await target(me, id);
  if (isResult(account)) return account;
  await updateAccount(account, { role });
  await logAction(me, role ? `role:${role}` : "role:none", account.email);
  revalidatePath(PAGE);
  return { ok: true };
}

export async function banUser(id: string, reason: string): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  const account = await target(me, id);
  if (isResult(account)) return account;
  const why = String(reason ?? "").trim().slice(0, 200) || null;
  // Un compte banni perd aussi son rôle : il faudra le redonner explicitement.
  await updateAccount(account, { bannedAt: new Date().toISOString(), banReason: why, role: null });
  await logAction(me, "ban", account.email, why ?? undefined);
  revalidatePath(PAGE);
  return { ok: true };
}

export async function unbanUser(id: string): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  const account = await target(me, id);
  if (isResult(account)) return account;
  await updateAccount(account, { bannedAt: null, banReason: null });
  await logAction(me, "unban", account.email);
  revalidatePath(PAGE);
  return { ok: true };
}

export async function verifyUserEmail(id: string): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  const account = await target(me, id);
  if (isResult(account)) return account;
  await markVerified(account);
  await logAction(me, "verify", account.email);
  revalidatePath(PAGE);
  return { ok: true };
}

// Suppression définitive : compte et profil (suivis, réglages), comme « Supprimer mes données ».
export async function deleteUser(id: string): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  const account = await target(me, id);
  if (isResult(account)) return account;
  await deleteProfile(account.id);
  await deleteAccount(account);
  await logAction(me, "delete", account.email);
  revalidatePath(PAGE);
  return { ok: true };
}

export async function removeSosAlert(id: string): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  await removeAlert(String(id));
  await logAction(me, "remove:sos", String(id));
  revalidatePath(PAGE);
  return { ok: true };
}

export async function removeWitnessReport(id: string): Promise<AdminResult> {
  const me = await staff();
  if (!me) return { ok: false, error: "forbidden" };
  await removeReport(String(id));
  await logAction(me, "remove:report", String(id));
  revalidatePath(PAGE);
  return { ok: true };
}
