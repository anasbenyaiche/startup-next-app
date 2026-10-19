import { currentAccount } from "@/auth";

// Modérateurs : adresses e-mail listées dans ADMIN_EMAILS (séparées par des virgules),
// sur un compte dont l'adresse est vérifiée.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const account = await currentAccount();
  return !!account?.verifiedAt && adminEmails().includes(account.email.toLowerCase());
}
