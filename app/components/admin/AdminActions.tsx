"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  banUser,
  deleteUser,
  removeSosAlert,
  removeWitnessReport,
  setUserRole,
  unbanUser,
  verifyUserEmail,
  type AdminResult,
} from "@/app/actions/admin";
import { getDictionary, type Locale } from "@/lib/i18n";
import { runAction } from "../staleDeployment";

const button =
  "rounded-[3px] border-[1.5px] px-2.5 py-1 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu";
const neutral = `${button} border-encre/40 hover:border-encre hover:bg-papier-fonce`;
const danger = `${button} border-[#c0262d]/60 text-[#c0262d] hover:bg-[#c0262d] hover:text-white`;

function useAdminAction(locale: Locale) {
  const t = getDictionary(locale).admin;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<AdminResult>) =>
    start(async () => {
      setError(null);
      const res = await runAction(action);
      if (!res) return;
      if (res.ok) router.refresh();
      else setError(t.errors[res.error]);
    });
  return { pending, error, run, t };
}

// Actions sur un compte (administrateurs seulement).
export function UserActions({
  id,
  email,
  role,
  banned,
  verified,
  locale,
}: {
  id: string;
  email: string;
  role: "admin" | "moderator" | null;
  banned: boolean;
  verified: boolean;
  locale: Locale;
}) {
  const { pending, error, run, t } = useAdminAction(locale);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {!banned && role !== "moderator" && (
          <button disabled={pending} onClick={() => run(() => setUserRole(id, "moderator"))} className={neutral}>
            {t.makeModerator}
          </button>
        )}
        {!banned && role !== "admin" && (
          <button disabled={pending} onClick={() => run(() => setUserRole(id, "admin"))} className={neutral}>
            {t.makeAdmin}
          </button>
        )}
        {role && (
          <button disabled={pending} onClick={() => run(() => setUserRole(id, null))} className={neutral}>
            {t.removeRole}
          </button>
        )}
        {!verified && (
          <button disabled={pending} onClick={() => run(() => verifyUserEmail(id))} className={neutral}>
            {t.verify}
          </button>
        )}
        {banned ? (
          <button disabled={pending} onClick={() => run(() => unbanUser(id))} className={neutral}>
            {t.unban}
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() => {
              const reason = window.prompt(t.banPrompt);
              if (reason === null) return;
              run(() => banUser(id, reason));
            }}
            className={danger}
          >
            {t.ban}
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => window.confirm(t.confirmDelete(email)) && run(() => deleteUser(id))}
          className={danger}
        >
          {t.delete}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-[#c0262d]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Retrait d'une alerte SOS ou d'un signalement (modérateurs et administrateurs).
export function RemoveContent({ id, kind, locale }: { id: string; kind: "sos" | "report"; locale: Locale }) {
  const { pending, error, run, t } = useAdminAction(locale);
  return (
    <>
      <button
        disabled={pending}
        onClick={() => window.confirm(t.confirmRemove) && run(() => (kind === "sos" ? removeSosAlert(id) : removeWitnessReport(id)))}
        className={danger}
      >
        {t.remove}
      </button>
      {error && (
        <p className="mt-1 text-sm text-[#c0262d]" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
