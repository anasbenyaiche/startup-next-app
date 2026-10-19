"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import {
  consumeToken,
  createPasswordAccount,
  createToken,
  getAccountByEmail,
  normalizeEmail,
  replaceUnverifiedPassword,
  setPassword,
  underLimit,
  validPassword,
} from "@/lib/accounts";
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "@/lib/i18n";
import { sendAccountMail } from "@/lib/mail";
import { safeReturnPath } from "@/lib/return-path";
import { siteOrigin } from "@/lib/site";

// Actions des formulaires de connexion. Elles renvoient un code (traduit par le
// formulaire) plutôt qu'un texte. Inscription et mot de passe oublié répondent
// toujours pareil, que l'adresse ait un compte ou non : la page ne doit pas
// permettre de deviner qui est inscrit.

export type AuthCode =
  | "invalid"
  | "unverified"
  | "tooMany"
  | "badEmail"
  | "badPassword"
  | "badLink"
  | "generic"
  | "checkEmail"
  | "passwordUpdated";

export type AuthState = { code: AuthCode | null };

function localeFrom(form: FormData): Locale {
  const raw = String(form.get("locale") ?? "");
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function signInWithPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeFrom(form);
  const email = normalizeEmail(form.get("email"));
  const password = form.get("password");
  if (!email) return { code: "badEmail" };
  if (typeof password !== "string" || !password) return { code: "invalid" };
  try {
    await signIn("credentials", {
      email,
      password,
      locale,
      redirectTo: safeReturnPath(form.get("retour"), locale),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === "unverified") return { code: "unverified" };
      if (code === "too_many") return { code: "tooMany" };
      if (err.type === "CredentialsSignin") return { code: "invalid" };
      console.error("[auth] connexion par mot de passe :", err);
      return { code: "generic" };
    }
    throw err; // La redirection après une connexion réussie passe par une exception.
  }
  return { code: null };
}

export async function signInWithGoogle(form: FormData) {
  const locale = localeFrom(form);
  await signIn("google", { redirectTo: safeReturnPath(form.get("retour"), locale) });
}

export async function register(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeFrom(form);
  const email = normalizeEmail(form.get("email"));
  const password = form.get("password");
  if (!email) return { code: "badEmail" };
  if (!validPassword(password)) return { code: "badPassword" };
  if (!(await underLimit(`register:ip:${await clientIp()}`, 10, 3600))) return { code: "tooMany" };
  // Au plus 3 e-mails par heure vers une même adresse.
  if (!(await underLimit(`mail:${email}`, 3, 3600))) return { code: "checkEmail" };

  try {
    const origin = await siteOrigin();
    const existing = await getAccountByEmail(email);
    if (existing?.verifiedAt) {
      // Déjà inscrite : on prévient la personne au lieu de le dire à la page.
      const token = await createToken("reset", email);
      await sendAccountMail("alreadyRegistered", email, resetLink(origin, locale, token), locale);
    } else {
      if (existing) await replaceUnverifiedPassword(existing, password);
      else await createPasswordAccount(email, password);
      const token = await createToken("verify", email);
      await sendAccountMail("verify", email, `${origin}/api/compte/verifier?jeton=${token}&lang=${locale}`, locale);
    }
  } catch (err) {
    console.error("[auth] inscription :", err);
    return { code: "generic" };
  }
  return { code: "checkEmail" };
}

function resetLink(origin: string, locale: Locale, token: string) {
  return `${origin}${localePath(locale, "/connexion")}?vue=nouveau&jeton=${token}`;
}

export async function forgotPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeFrom(form);
  const email = normalizeEmail(form.get("email"));
  if (!email) return { code: "badEmail" };
  if (!(await underLimit(`forgot:ip:${await clientIp()}`, 10, 3600))) return { code: "tooMany" };
  try {
    const account = await getAccountByEmail(email);
    if (account && (await underLimit(`mail:${email}`, 3, 3600))) {
      const token = await createToken("reset", email);
      await sendAccountMail("reset", email, resetLink(await siteOrigin(), locale, token), locale);
    }
  } catch (err) {
    console.error("[auth] mot de passe oublié :", err);
    return { code: "generic" };
  }
  return { code: "checkEmail" };
}

export async function resetPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = form.get("password");
  // Le mot de passe est vérifié avant d'utiliser le jeton, pour ne pas le gaspiller.
  if (!validPassword(password)) return { code: "badPassword" };
  const email = await consumeToken("reset", form.get("jeton"));
  const account = email ? await getAccountByEmail(email) : null;
  if (!account) return { code: "badLink" };
  await setPassword(account, password);
  return { code: "passwordUpdated" };
}

// Page de connexion dans la langue du chemin de retour (/fr/…, /en/…).
export async function goToSignIn(returnPath: string) {
  const first = returnPath.split("/")[1];
  const locale: Locale = isLocale(first) ? first : DEFAULT_LOCALE;
  const retour = safeReturnPath(returnPath, locale);
  redirect(`${localePath(locale, "/connexion")}?retour=${encodeURIComponent(retour)}`);
}
