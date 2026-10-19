"use client";

import { useState, useTransition } from "react";
import { flag } from "@/app/actions/announcements";
import type { Announcement } from "@/lib/announcements";
import { getDictionary, type Locale } from "@/lib/i18n";
import { runAction } from "../staleDeployment";

export const ANNOUNCEMENT_ICON = "📅";

// Fiche d'une manifestation annoncée, dans le panneau de la carte. Données chargées
// dans le navigateur : les dates peuvent être formatées à l'heure locale sans risque d'hydratation.
export default function AnnouncementDetails({
  announcement: a,
  locale,
  signedIn,
  onBack,
  onSignIn,
  onFlagged,
}: {
  announcement: Announcement;
  locale: Locale;
  signedIn: boolean;
  onBack: () => void;
  onSignIn: () => void;
  onFlagged: (a: Announcement) => void;
}) {
  const dict = getDictionary(locale);
  const t = dict.announcements;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const report = () => {
    if (!signedIn) return onSignIn();
    start(async () => {
      const res = await runAction(() => flag(a.id));
      if (!res) return;
      if (res.ok) {
        setMessage({ text: t.flagged, error: false });
        onFlagged(res.value);
      } else setMessage({ text: dict.create.errors[res.error], error: true });
    });
  };

  return (
    <article className="space-y-5">
      <button onClick={onBack} className="text-sm font-semibold text-bleu hover:underline underline-offset-4">
        {dict.details.back}
      </button>
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-gris">
          {ANNOUNCEMENT_ICON} {dict.create.kinds[a.kind]}
        </p>
        <h1 className="display text-[2.2rem] mt-1 break-words">{a.title}</h1>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        <dt className="text-gris">{t.when}</dt>
        <dd className="first-letter:uppercase">
          {date(a.startsAt)}
          {a.endsAt && <span className="block text-sm text-gris">→ {date(a.endsAt)}</span>}
        </dd>
        <dt className="text-gris">{t.where}</dt>
        <dd>
          {a.meetingPoint}
          <span className="block text-sm text-gris">{a.city}</span>
        </dd>
        {a.organizer && (
          <>
            <dt className="text-gris">{t.organizer}</dt>
            <dd>{a.organizer}</dd>
          </>
        )}
      </dl>

      {a.description && <p className="whitespace-pre-line leading-relaxed break-words">{a.description}</p>}

      <ul className="flex flex-wrap gap-1.5 text-sm">
        <li className="rounded-full border-[1.5px] border-encre px-2.5 py-0.5">✓ {t.verified}</li>
        <li className={`rounded-full border-[1.5px] px-2.5 py-0.5 ${a.declared ? "border-encre" : "border-dashed border-gris text-gris"}`}>
          {a.declared ? t.declared : t.notDeclared}
        </li>
      </ul>

      {a.sourceUrl && (
        <a
          href={a.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="inline-block font-semibold text-bleu hover:underline underline-offset-4"
        >
          {t.source} ↗
        </a>
      )}

      <div>
        <button
          onClick={report}
          disabled={pending}
          className="rounded-[3px] border-[1.5px] border-encre px-3 py-1.5 text-sm font-semibold hover:bg-papier-fonce disabled:opacity-50"
        >
          {t.flag}
        </button>
        {message && (
          <p className={`mt-2 text-sm ${message.error ? "text-[#c0262d]" : ""}`} role="status">
            {message.text}
          </p>
        )}
      </div>

      <p className="text-sm text-gris">{t.disclaimer}</p>
    </article>
  );
}
