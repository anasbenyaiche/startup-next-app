"use client";

import { useState, useTransition } from "react";
import { publishReport, voteOnReport, type ReportResult } from "@/app/actions/reports";
import { getDictionary, plural, type Locale } from "@/lib/i18n";
import type { CrowdSize, PublicReport, ReportKind } from "@/lib/reports";
import { relativeTime } from "./relativeTime";
import { runAction } from "./staleDeployment";

// Formulaire et fiche des signalements des témoins, affichés dans le panneau de la carte.

export const REPORT_ICONS: Record<ReportKind, string> = {
  march: "🚶",
  gathering: "📢",
  teargas: "💨",
  danger: "⚠️",
  blocked: "🚧",
};

const KINDS = Object.keys(REPORT_ICONS) as ReportKind[];
const CROWDS: CrowdSize[] = ["small", "medium", "large"];

const field = "w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-2.5 py-2";
const primary =
  "rounded-[3px] border-[1.5px] border-encre bg-encre px-3 py-1.5 font-semibold text-papier disabled:opacity-50";
const secondary =
  "rounded-[3px] border-[1.5px] border-encre px-3 py-1.5 font-semibold hover:bg-papier-fonce disabled:opacity-50";

export function ReportForm({
  locale,
  point,
  locating,
  locateFailed,
  onLocate,
  onCancel,
  onPublished,
}: {
  locale: Locale;
  point: { lat: number; lng: number } | null;
  locating: boolean;
  locateFailed: boolean;
  onLocate: () => void;
  onCancel: () => void;
  onPublished: (report: PublicReport) => void;
}) {
  const t = getDictionary(locale).reports;
  const [kind, setKind] = useState<ReportKind>("march");
  const [crowd, setCrowd] = useState<CrowdSize | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const withCrowd = kind === "march" || kind === "gathering";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!point) return;
    setError(null);
    start(async () => {
      const result = await runAction(() =>
        publishReport(
          {
            kind,
            lat: point.lat,
            lng: point.lng,
            crowd: withCrowd ? crowd : null,
            videoUrl: videoUrl.trim() || null,
          },
          consent,
        ),
      );
      if (!result) return;
      if (result.ok) onPublished(result.value);
      else setError(t.errors[result.error]);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <button
        type="button"
        onClick={onCancel}
        className="text-sm font-semibold text-bleu hover:underline underline-offset-4"
      >
        {t.cancel}
      </button>
      <div>
        <h1 className="display text-[2.2rem]">{t.title}</h1>
        <p className="mt-2 text-sm" role="status">
          {point ? t.pointSet : t.pickHint}
        </p>
        <button type="button" onClick={onLocate} disabled={locating} className={`mt-2 ${secondary} text-sm`}>
          {locating ? t.locating : `📍 ${t.useMyPosition}`}
        </button>
        {locateFailed && <p className="mt-1 text-sm text-[#c0262d]">{t.locationFailed}</p>}
      </div>

      <fieldset>
        <legend className="text-sm text-gris mb-1.5">{t.kind}</legend>
        <div className="grid grid-cols-1 gap-1.5">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-[3px] border-[1.5px] px-2.5 py-1.5 ${
                kind === k ? "border-encre bg-papier-fonce font-semibold" : "border-encre/25"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              <span aria-hidden="true">{REPORT_ICONS[k]}</span>
              {t.kinds[k]}
            </label>
          ))}
        </div>
      </fieldset>

      {withCrowd && (
        <fieldset>
          <legend className="text-sm text-gris mb-1.5">{t.crowd}</legend>
          <div className="flex flex-wrap gap-1.5">
            {CROWDS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={crowd === c}
                onClick={() => setCrowd(crowd === c ? null : c)}
                className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-sm ${crowd === c ? "border-encre bg-encre text-papier" : "border-encre/40"}`}
              >
                {t.crowds[c]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="text-sm text-gris">{t.video}</span>
        <input
          type="url"
          inputMode="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@…/video/…"
          className={`mt-1 ${field}`}
        />
        <span className="text-xs text-gris">{t.videoHint}</span>
      </label>

      <p className="text-sm text-encre/80">{t.safety}</p>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-[rgb(var(--encre))]"
          required
        />
        {t.consent}
      </label>

      {error && (
        <p className="text-sm text-[#c0262d]" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={!point || !consent || pending} className={primary}>
          {pending ? t.sending : t.submit}
        </button>
        <button type="button" onClick={onCancel} className={secondary}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

export function ReportDetails({
  report,
  locale,
  signedIn,
  notice,
  onBack,
  onSignIn,
  onUpdated,
}: {
  report: PublicReport;
  locale: Locale;
  signedIn: boolean;
  notice: string | null;
  onBack: () => void;
  onSignIn: () => void;
  // null : le signalement a été retiré (trop de signalements d'abus) ou a expiré.
  onUpdated: (report: PublicReport | null, message: string) => void;
}) {
  const dict = getDictionary(locale);
  const t = dict.reports;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const vote = (v: "confirm" | "flag") => {
    if (!signedIn) return onSignIn();
    setError(null);
    start(async () => {
      const result: ReportResult<PublicReport | null> | undefined = await runAction(() => voteOnReport(report.id, v));
      if (!result) return;
      if (result.ok) onUpdated(result.value, result.value ? t.voted : t.removed);
      else if (result.error === "notFound") onUpdated(null, t.errors.notFound);
      else setError(t.errors[result.error]);
    });
  };

  return (
    <article className="space-y-5">
      <button onClick={onBack} className="text-sm font-semibold text-bleu hover:underline underline-offset-4">
        {dict.details.back}
      </button>
      <header>
        <p className="text-4xl" aria-hidden="true">
          {REPORT_ICONS[report.kind]}
        </p>
        <h1 className="display text-[2.2rem] mt-1">{t.kinds[report.kind]}</h1>
        {report.crowd && (
          <p className="mt-1">
            {t.crowd} : <strong>{t.crowds[report.crowd]}</strong>
          </p>
        )}
        <p className="mt-2 text-sm text-gris">
          {t.reportedAt(relativeTime(locale, report.createdAt))} · {t.expiresAt(relativeTime(locale, report.expiresAt))}
        </p>
      </header>

      {notice && (
        <p className="rounded-[3px] bg-papier-fonce px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      )}

      <p className="text-lg">
        <strong className="tabular-nums">{report.confirms.toLocaleString(locale)}</strong>{" "}
        {plural(locale, report.confirms, t.confirms)}
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => vote("confirm")} disabled={pending} className={primary}>
          ✓ {t.confirm}
        </button>
        <button onClick={() => vote("flag")} disabled={pending} className={secondary}>
          {t.flag}
        </button>
      </div>
      {error && (
        <p className="text-sm text-[#c0262d]" role="alert">
          {error}
        </p>
      )}

      {report.videoUrl && (
        <a
          href={report.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-semibold text-bleu hover:underline underline-offset-4"
        >
          ▶ {t.openVideo}
        </a>
      )}

      <p className="text-sm text-gris">{t.disclaimer}</p>
    </article>
  );
}
