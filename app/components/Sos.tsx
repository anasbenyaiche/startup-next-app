"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reportFalseAlert, sendAlert, showDemoAlerts, withdrawAlert } from "@/app/actions/alerts";
import type { AlertKind, SosAlert } from "@/lib/alerts";
import { emergencyNumbers, type EmergencyKind } from "@/lib/emergency";
import { getDictionary, type Locale } from "@/lib/i18n";
import { relativeTime } from "./relativeTime";
import { runAction } from "./staleDeployment";

// Alertes SOS : une fenêtre pensée pour l'urgence (deux gestes : SOS, puis le type),
// et la fiche d'une alerte dans le panneau de la carte.

export const SOS_ICONS: Record<AlertKind, string> = { fire: "🔥", looting: "🚨", injured: "🚑" };
const KINDS: AlertKind[] = ["fire", "looting", "injured"];
// Numéro à appeler selon l'urgence, quand le pays en a un dédié.
const CALL_KIND: Record<AlertKind, EmergencyKind> = { fire: "fire", looting: "police", injured: "medical" };

// Alertes envoyées depuis ce navigateur : leur auteur peut les annuler.
const MINE_KEY = "cortege-sos-mine";
export function myAlertIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(MINE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function rememberMine(id: string) {
  try {
    sessionStorage.setItem(MINE_KEY, JSON.stringify([...myAlertIds(), id].slice(-20)));
  } catch {
    // Stockage indisponible (navigation privée) : l'annulation reste possible tant que la fenêtre est ouverte.
  }
}

// Numéro à appeler : celui de l'urgence choisie s'il existe, sinon le numéro général.
export function callNumber(visitorIso: string | null, kind: AlertKind | null): string {
  const numbers = emergencyNumbers(visitorIso);
  return (
    (kind ? numbers?.find((n) => n.kind === CALL_KIND[kind])?.number : undefined) ??
    numbers?.find((n) => n.kind === "general")?.number ??
    numbers?.[0]?.number ??
    "112"
  );
}

type Position = { lat: number; lng: number; accuracy: number | null };

export function SosSheet({
  locale,
  canSend,
  admin,
  visitorIso,
  pickedPoint,
  mapCenter,
  onClose,
  onPickOnMap,
  onSignIn,
  onSent,
  onCancelled,
  onDemo,
}: {
  locale: Locale;
  canSend: boolean;
  admin: boolean;
  visitorIso: string | null;
  // Point touché sur la carte quand la position n'a pas pu être lue.
  pickedPoint: { lat: number; lng: number } | null;
  mapCenter: () => { lat: number; lng: number } | null;
  onClose: () => void;
  onPickOnMap: () => void;
  onSignIn: () => void;
  onSent: (alert: SosAlert) => void;
  onCancelled: (id: string) => void;
  onDemo: (alerts: SosAlert[]) => void;
}) {
  const t = getDictionary(locale).sos;
  const [position, setPosition] = useState<Position | null>(pickedPoint ? { ...pickedPoint, accuracy: null } : null);
  const [locating, setLocating] = useState(!pickedPoint);
  const [sent, setSent] = useState<SosAlert | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDivElement>(null);

  // La position est demandée dès l'ouverture : le temps de choisir le type, elle est prête.
  useEffect(() => {
    if (pickedPoint || !canSend) return;
    if (!navigator.geolocation) return setLocating(false);
    // Le délai du navigateur ne court qu'une fois l'autorisation donnée : si la demande
    // reste sans réponse, on cesse d'attendre au bout de 10 secondes.
    const giveUp = setTimeout(() => setLocating(false), 10_000);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(giveUp);
        setPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy) });
        setLocating(false);
      },
      () => {
        clearTimeout(giveUp);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
    return () => clearTimeout(giveUp);
  }, [pickedPoint, canSend]);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = (kind: AlertKind) => {
    if (!position) return;
    setMessage(null);
    start(async () => {
      const res = await runAction(() => sendAlert({ kind, lat: position.lat, lng: position.lng }));
      if (!res) return;
      if (!res.ok) return setMessage(t.errors[res.error]);
      rememberMine(res.value.id);
      setSent(res.value);
      onSent(res.value);
    });
  };

  const cancel = () => {
    if (!sent) return;
    start(async () => {
      const res = await runAction(() => withdrawAlert(sent.id));
      if (res?.ok) {
        onCancelled(sent.id);
        setSent(null);
        setMessage(t.cancelled);
      }
    });
  };

  const demo = () => {
    const center = position ?? mapCenter();
    if (!center) return;
    start(async () => {
      const res = await runAction(() => showDemoAlerts(center.lat, center.lng));
      if (res?.ok) {
        onDemo(res.value);
        onClose();
      } else if (res) setMessage(t.errors[res.error]);
    });
  };

  const general = callNumber(visitorIso, null);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-encre/60 p-0 sm:p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[14px] sm:rounded-[6px] border-[2px] border-encre bg-papier p-5 shadow-[6px_6px_0_rgb(var(--encre))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sos-title" className="display text-[2rem] leading-none text-[#c0262d]">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-gris">{t.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-sm font-semibold text-bleu hover:underline underline-offset-4">
            {t.close}
          </button>
        </div>

        <a
          href={`tel:${general}`}
          className="mt-4 flex items-center justify-between gap-3 rounded-[4px] bg-[#c0262d] px-4 py-3 font-bold text-white"
        >
          <span className="text-sm leading-snug">{t.callFirst}</span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[#c0262d]">📞 {general}</span>
        </a>

        {sent ? (
          <div className="mt-5 space-y-4" role="status">
            <p className="flex items-center gap-3 text-lg font-bold">
              <span className="sos-dot" aria-hidden="true">
                {SOS_ICONS[sent.kind]}
              </span>
              {t.sent}
            </p>
            <a
              href={`tel:${callNumber(visitorIso, sent.kind)}`}
              className="block rounded-[4px] border-[2px] border-encre px-4 py-3 text-center text-lg font-bold"
            >
              📞 {t.call(callNumber(visitorIso, sent.kind))}
            </a>
            <button onClick={cancel} disabled={pending} className="w-full text-sm font-semibold text-[#c0262d] underline-offset-4 hover:underline">
              {t.cancel}
            </button>
          </div>
        ) : !canSend ? (
          <div className="mt-5 space-y-3">
            <p>{t.signIn}</p>
            <button
              data-autofocus
              onClick={onSignIn}
              className="w-full rounded-[4px] border-[2px] border-encre bg-encre px-4 py-3 text-lg font-bold text-papier"
            >
              {t.signInCta}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm" aria-live="polite">
              {pickedPoint
                ? t.pointSet
                : locating
                  ? t.locating
                  : position
                    ? t.located(position.accuracy ?? 0)
                    : t.locateFailed}
            </p>
            {/* Toujours proposé tant qu'il n'y a pas de position : sans attendre la fin de la recherche. */}
            {!position && (
              <button
                onClick={onPickOnMap}
                className="mt-2 w-full rounded-[4px] border-[2px] border-dashed border-encre px-4 py-2.5 font-semibold"
              >
                📍 {t.pickOnMap}
              </button>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {KINDS.map((kind, i) => (
                <button
                  key={kind}
                  data-autofocus={i === 0 ? true : undefined}
                  onClick={() => send(kind)}
                  disabled={!position || pending}
                  className={`sos-choice sos-choice-${kind} flex flex-col items-center gap-1 rounded-[6px] border-[2px] border-encre px-1 py-4 text-center disabled:opacity-40`}
                >
                  <span className="text-[2.4rem] leading-none" aria-hidden="true">
                    {SOS_ICONS[kind]}
                  </span>
                  <span className="font-bold leading-tight">{t.kinds[kind]}</span>
                  <span className="text-[0.7rem] leading-tight opacity-80">{t.kindHints[kind]}</span>
                </button>
              ))}
            </div>
            {pending && <p className="mt-3 text-sm font-semibold">{t.sending}</p>}
          </>
        )}

        {message && (
          <p className="mt-3 text-sm font-semibold" role="alert">
            {message}
          </p>
        )}

        {admin && !sent && (
          <button onClick={demo} disabled={pending} className="mt-5 text-sm text-gris underline underline-offset-4">
            {t.demoButton}
          </button>
        )}
      </div>
    </div>
  );
}

export function SosDetails({
  alert,
  locale,
  now,
  canSend,
  visitorIso,
  onBack,
  onSignIn,
  onUpdated,
}: {
  alert: SosAlert;
  locale: Locale;
  now: number;
  canSend: boolean;
  visitorIso: string | null;
  onBack: () => void;
  onSignIn: () => void;
  // null : alerte retirée (annulée ou signalée comme fausse).
  onUpdated: (alert: SosAlert | null, message: string) => void;
}) {
  const dict = getDictionary(locale);
  const t = dict.sos;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  useEffect(() => setMine(myAlertIds().includes(alert.id)), [alert.id]);
  // L'horloge de la carte avance par pas de 5 s : une alerte toute neuve ne doit pas afficher 16 min.
  const minutes = Math.min(15, Math.max(0, Math.ceil((Date.parse(alert.expiresAt) - now) / 60_000)));
  const number = callNumber(visitorIso, alert.kind);

  const flag = () => {
    if (!canSend) return onSignIn();
    start(async () => {
      const res = await runAction(() => reportFalseAlert(alert.id));
      if (!res) return;
      if (res.ok) {
        setMessage(res.value ? t.flagged : t.removed);
        onUpdated(res.value, res.value ? t.flagged : t.removed);
      } else setMessage(t.errors[res.error]);
    });
  };
  const cancel = () =>
    start(async () => {
      const res = await runAction(() => withdrawAlert(alert.id));
      if (res?.ok) onUpdated(null, t.cancelled);
      else if (res) setMessage(t.errors[res.error]);
    });

  return (
    <article className="space-y-5">
      <button onClick={onBack} className="text-sm font-semibold text-bleu hover:underline underline-offset-4">
        {dict.details.back}
      </button>
      <header className="flex items-center gap-4">
        <span className={`sos-dot sos-dot-lg sos-${alert.kind}`} aria-hidden="true">
          {SOS_ICONS[alert.kind]}
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#c0262d]">
            SOS {alert.demo && <span className="ms-1 rounded-[3px] bg-encre px-1.5 py-0.5 text-papier normal-case">{t.demo}</span>}
          </p>
          <h1 className="display text-[2.2rem] leading-none">{t.kinds[alert.kind]}</h1>
          <p className="text-sm text-gris">{t.kindHints[alert.kind]}</p>
        </div>
      </header>

      <p className="text-sm">
        {t.ago(relativeTime(locale, alert.createdAt, now))} · <strong>{t.remaining(minutes)}</strong>
      </p>
      {/* Temps restant sur 15 minutes. */}
      <div className="h-2 rounded-full bg-encre/10" aria-hidden="true">
        <div className="h-full rounded-full bg-[#c0262d]" style={{ width: `${Math.min(100, (minutes / 15) * 100)}%` }} />
      </div>

      <a href={`tel:${number}`} className="block rounded-[4px] bg-[#c0262d] px-4 py-3 text-center text-lg font-bold text-white">
        📞 {t.call(number)}
      </a>

      <div className="flex flex-wrap gap-2">
        {mine ? (
          <button onClick={cancel} disabled={pending} className="rounded-[3px] border-[1.5px] border-encre px-3 py-1.5 font-semibold">
            {t.cancel}
          </button>
        ) : (
          <button onClick={flag} disabled={pending} className="rounded-[3px] border-[1.5px] border-encre px-3 py-1.5 font-semibold">
            {t.flag}
          </button>
        )}
      </div>
      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
      <p className="text-sm text-gris">{t.disclaimer}</p>
    </article>
  );
}
