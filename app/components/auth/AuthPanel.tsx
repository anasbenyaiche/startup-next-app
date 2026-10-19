"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import {
  forgotPassword,
  register,
  resetPassword,
  signInWithGoogle,
  signInWithPassword,
  type AuthCode,
  type AuthState,
} from "@/app/actions/account";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";

export type AuthView = "signIn" | "register" | "forgot" | "reset";

// Même valeur que PASSWORD_MIN de lib/accounts.ts (non importé : module serveur).
const PASSWORD_MIN = 10;
const input = "mt-1 w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-3 py-2 text-base";
const primary =
  "w-full rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-2.5 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu disabled:opacity-60";
const secondary =
  "w-full flex items-center justify-center gap-2.5 rounded-[3px] border-[1.5px] border-encre bg-papier px-5 py-2.5 font-semibold hover:bg-papier-fonce disabled:opacity-60";
const linkClass = "text-bleu underline-offset-4 hover:underline";

const SUCCESS: AuthCode[] = ["checkEmail", "passwordUpdated"];

function Message({ code, locale }: { code: AuthCode | "verified" | "google" | null; locale: Locale }) {
  if (!code) return null;
  const t = getDictionary(locale).auth;
  const text =
    code === "checkEmail"
      ? t.checkEmail
      : code === "passwordUpdated"
        ? t.passwordUpdated
        : code === "verified"
          ? t.verified
          : code === "badPassword"
            ? t.errors.badPassword(PASSWORD_MIN)
            : t.errors[code];
  const ok = code === "verified" || SUCCESS.includes(code as AuthCode);
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-[3px] border-[1.5px] px-3 py-2 text-sm ${ok ? "border-bleu/50 bg-bleu/5" : "border-[#c0262d]/60 bg-[#c0262d]/5 text-[#8f1c21]"}`}
    >
      {text}
    </p>
  );
}

function Hidden({ locale, retour, token }: { locale: Locale; retour: string; token?: string }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="retour" value={retour} />
      {token !== undefined && <input type="hidden" name="jeton" value={token} />}
    </>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-gris">{hint}</span>}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function AuthPanel({
  locale,
  view,
  retour,
  token,
  notice,
  googleEnabled,
}: {
  locale: Locale;
  view: AuthView;
  retour: string;
  token: string;
  notice: "verified" | "badLink" | "google" | null;
  googleEnabled: boolean;
}) {
  const t = getDictionary(locale).auth;
  const initial: AuthState = { code: null };
  const action = { signIn: signInWithPassword, register, forgot: forgotPassword, reset: resetPassword }[view];
  const [state, formAction, pending] = useActionState(action, initial);

  // Liens entre les vues : le chemin de retour suit la personne.
  const href = (vue: string | null) => {
    const q = new URLSearchParams({ retour });
    if (vue) q.set("vue", vue);
    return `${localePath(locale, "/connexion")}?${q}`;
  };

  const title = { signIn: t.title, register: t.registerTitle, forgot: t.forgotTitle, reset: t.resetTitle }[view];
  const done = state.code !== null && SUCCESS.includes(state.code);

  return (
    <div className="space-y-6">
      <h1 className="display text-[clamp(2.2rem,7vw,3rem)]">{title}</h1>
      <Message code={state.code ?? notice} locale={locale} />

      {googleEnabled && (view === "signIn" || view === "register") && (
        <>
          <form action={signInWithGoogle}>
            <Hidden locale={locale} retour={retour} />
            <button type="submit" className={secondary}>
              <GoogleIcon />
              {t.google}
            </button>
          </form>
          <p className="flex items-center gap-3 text-sm text-gris" aria-hidden="true">
            <span className="h-px flex-1 bg-encre/20" />
            {t.or}
            <span className="h-px flex-1 bg-encre/20" />
          </p>
        </>
      )}

      {!(done && view !== "signIn") && (
        <form action={formAction} className="space-y-4">
          <Hidden locale={locale} retour={retour} token={view === "reset" ? token : undefined} />
          {view !== "reset" && (
            <Field label={t.email}>
              <input name="email" type="email" required autoComplete="email" className={input} />
            </Field>
          )}
          {(view === "signIn" || view === "register" || view === "reset") && (
            <Field
              label={view === "reset" ? t.newPassword : t.password}
              hint={view === "signIn" ? undefined : t.passwordHint(PASSWORD_MIN)}
            >
              <input
                name="password"
                type="password"
                required
                minLength={view === "signIn" ? undefined : PASSWORD_MIN}
                maxLength={200}
                autoComplete={view === "signIn" ? "current-password" : "new-password"}
                className={input}
              />
            </Field>
          )}
          <button type="submit" disabled={pending} className={primary}>
            {{ signIn: t.submitSignIn, register: t.submitRegister, forgot: t.submitForgot, reset: t.submitReset }[view]}
          </button>
        </form>
      )}

      <nav className="flex flex-col gap-2 text-sm">
        {view === "signIn" && (
          <>
            <Link href={href("oubli")} className={linkClass}>
              {t.toForgot}
            </Link>
            <Link href={href("inscription")} className={linkClass}>
              {t.toRegister}
            </Link>
          </>
        )}
        {view !== "signIn" && (
          <Link href={href(null)} className={linkClass}>
            {t.toSignIn}
          </Link>
        )}
      </nav>
    </div>
  );
}
