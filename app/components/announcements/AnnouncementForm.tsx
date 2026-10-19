"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { publish } from "@/app/actions/announcements";
import type { Announcement } from "@/lib/community/announcements";
import { LIMITS, type ComplianceReport } from "@/lib/community/compliance";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import type { LatLng } from "../leaflet";
import { runAction } from "../staleDeployment";
import ComplianceReportView from "./ComplianceReportView";
import PointPicker from "./PointPicker";

const KINDS = ["march", "gathering", "strike", "blockade", "other"] as const;

const field = "mt-1 w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-2.5 py-2";
const label = "block text-sm font-semibold";
const hint = "mt-0.5 block text-xs text-gris";

type Result = { announcement: Announcement | null; report: ComplianceReport };

export default function AnnouncementForm({
  locale,
  countries,
  defaultCountry,
}: {
  locale: Locale;
  // Noms calculés côté serveur : le navigateur et Node ne nomment pas toujours les pays pareil.
  countries: { fips: string; name: string }[];
  defaultCountry: string | null;
}) {
  const dict = getDictionary(locale);
  const t = dict.create;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("march");
  const [country, setCountry] = useState(defaultCountry ?? "FR");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [declared, setDeclared] = useState(false);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setPoint({ lat: Number(coords.latitude.toFixed(5)), lng: Number(coords.longitude.toFixed(5)) });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    // Les dates sont saisies à l'heure locale du navigateur et envoyées en UTC.
    const iso = (name: string) => (text(name) ? new Date(text(name)).toISOString() : null);
    setError(null);
    start(async () => {
      const res = await runAction(() =>
        publish(
          {
            kind,
            title: text("title"),
            description: text("description"),
            country,
            city: text("city"),
            meetingPoint: text("meetingPoint"),
            organizer: text("organizer"),
            sourceUrl: text("sourceUrl"),
            lat: point?.lat ?? null,
            lng: point?.lng ?? null,
            startsAt: iso("startsAt"),
            endsAt: iso("endsAt"),
            declared,
          },
          consent,
        ),
      );
      if (!res) return;
      if (!res.ok) return setError(t.errors[res.error]);
      setResult(res.value);
      if (res.value.announcement) router.refresh();
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  };

  const reset = () => {
    formRef.current?.reset();
    setPoint(null);
    setDeclared(false);
    setConsent(false);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Annonce enregistrée (publiée ou en relecture) : le rapport remplace le formulaire.
  if (result?.announcement) {
    return (
      <div ref={reportRef} className="space-y-5">
        <h2 className="text-xl font-bold">{dict.compliance.title}</h2>
        <ComplianceReportView report={result.report} locale={locale} />
        <div className="flex flex-wrap gap-3">
          {result.announcement.status === "published" && (
            <a
              href={`${localePath(locale, "/manifestations")}?pays=${result.announcement.country}`}
              className="rounded-[3px] border-[1.5px] border-encre bg-encre px-4 py-2 font-semibold text-papier"
            >
              {t.seeOnMap}
            </a>
          )}
          <button onClick={reset} className="rounded-[3px] border-[1.5px] border-encre px-4 py-2 font-semibold hover:bg-papier-fonce">
            {t.another}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      {result && (
        // Refusée : le rapport s'affiche au-dessus du formulaire, resté rempli pour corriger.
        <div ref={reportRef} className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold">{dict.compliance.title}</h2>
          <ComplianceReportView report={result.report} locale={locale} />
        </div>
      )}

      <fieldset>
        <legend className={label}>{t.fields.kind}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full border-[1.5px] px-3 py-1 text-sm ${kind === k ? "border-encre bg-encre text-papier" : "border-encre/40"}`}
            >
              {t.kinds[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={label}>{t.fields.title}</span>
        <input name="title" required minLength={5} maxLength={LIMITS.title} placeholder={t.hints.title} className={field} />
      </label>

      <label className="block">
        <span className={label}>{t.fields.description}</span>
        <textarea name="description" rows={5} maxLength={LIMITS.description} className={field} />
        <span className={hint}>{t.hints.description}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>{t.fields.startsAt}</span>
          <input name="startsAt" type="datetime-local" required className={field} />
        </label>
        <label className="block">
          <span className={label}>{t.fields.endsAt}</span>
          <input name="endsAt" type="datetime-local" className={field} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>{t.fields.country}</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
            {countries.map((c) => (
              <option key={c.fips} value={c.fips}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>{t.fields.city}</span>
          <input name="city" required maxLength={LIMITS.city} className={field} />
        </label>
      </div>

      <label className="block">
        <span className={label}>{t.fields.meetingPoint}</span>
        <input name="meetingPoint" required maxLength={LIMITS.meetingPoint} placeholder={t.hints.meetingPoint} className={field} />
      </label>

      <div>
        <div className="flex items-end justify-between gap-3">
          <span className={label}>{t.fields.position}</span>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="rounded-[3px] border-[1.5px] border-encre px-2.5 py-1 text-sm font-semibold hover:bg-papier-fonce disabled:opacity-50"
          >
            {locating ? dict.reports.locating : `📍 ${dict.reports.useMyPosition}`}
          </button>
        </div>
        <span className={hint} role="status">
          {point ? t.positionSet : t.hints.position}
        </span>
        <div className="mt-2">
          <PointPicker value={point} onChange={setPoint} label={t.fields.position} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>{t.fields.organizer}</span>
          <input name="organizer" maxLength={LIMITS.organizer} className={field} />
          <span className={hint}>{t.hints.organizer}</span>
        </label>
        <label className="block">
          <span className={label}>{t.fields.sourceUrl}</span>
          <input name="sourceUrl" type="url" maxLength={LIMITS.sourceUrl} placeholder="https://" className={field} />
          <span className={hint}>{t.hints.sourceUrl}</span>
        </label>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={declared}
          onChange={(e) => setDeclared(e.target.checked)}
          className="mt-1 accent-[rgb(var(--encre))]"
        />
        <span>
          <span className={label}>{t.fields.declared}</span>
          <span className="text-sm">{t.hints.declared}</span>
        </span>
      </label>

      <label className="flex items-start gap-2 cursor-pointer text-sm border-t-[1.5px] border-encre pt-5">
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

      <button
        type="submit"
        disabled={pending || !consent}
        className="rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] disabled:opacity-50"
      >
        {pending ? t.sending : t.submit}
      </button>
    </form>
  );
}
