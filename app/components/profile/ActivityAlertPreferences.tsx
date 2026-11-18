"use client";

import { useState, useTransition } from "react";
import { saveActivityAlertPreferences } from "@/app/actions/profile";
import { runAction } from "@/app/components/staleDeployment";
import { ALERT_THRESHOLDS, type ActivityAlertSettings } from "@/lib/users/profile";
import type { Locale } from "@/lib/i18n";

const translations = {
  fr: { title: "Alertes d'activité", info: "Définissez un seuil pour les pays et lieux suivis. Les notifications ne sont pas encore envoyées.", enabled: "Activer les préférences d'alerte", threshold: "Seuil sur 6 heures", consent: "J'accepte l'enregistrement de mes préférences d'alerte liées aux lieux suivis.", save: "Enregistrer", saved: "Préférences enregistrées", disabled: "Désactiver supprime le consentement aux alertes.", error: "Enregistrement impossible. Réessayez." },
  en: { title: "Activity alerts", info: "Choose a threshold for followed places. Notifications are not sent yet.", enabled: "Enable alert preferences", threshold: "6-hour threshold", consent: "I agree to storing my alert preferences for followed places.", save: "Save", saved: "Preferences saved", disabled: "Disabling removes alert consent.", error: "Could not save. Please try again." },
  es: { title: "Alertas de actividad", info: "Elige un umbral para los lugares seguidos. Aún no se envían notificaciones.", enabled: "Activar preferencias de alerta", threshold: "Umbral en 6 horas", consent: "Acepto guardar mis preferencias de alerta para lugares seguidos.", save: "Guardar", saved: "Preferencias guardadas", disabled: "Desactivar elimina el consentimiento.", error: "No se pudo guardar." },
  pt: { title: "Alertas de atividade", info: "Escolha um limite para os locais seguidos. Ainda não são enviadas notificações.", enabled: "Ativar preferências de alerta", threshold: "Limite em 6 horas", consent: "Aceito guardar as minhas preferências de alerta para locais seguidos.", save: "Guardar", saved: "Preferências guardadas", disabled: "Desativar remove o consentimento.", error: "Não foi possível guardar." },
  de: { title: "Aktivitätswarnungen", info: "Wählen Sie einen Grenzwert für verfolgte Orte. Noch werden keine Benachrichtigungen versendet.", enabled: "Warnungseinstellungen aktivieren", threshold: "Grenzwert für 6 Stunden", consent: "Ich stimme der Speicherung meiner Warnungseinstellungen für verfolgte Orte zu.", save: "Speichern", saved: "Einstellungen gespeichert", disabled: "Deaktivieren widerruft die Einwilligung.", error: "Speichern fehlgeschlagen." },
  ar: { title: "تنبيهات النشاط", info: "حدد عتبة للأماكن المتابَعة. لا يتم إرسال إشعارات حالياً.", enabled: "تفعيل تفضيلات التنبيه", threshold: "الحد خلال ٦ ساعات", consent: "أوافق على حفظ تفضيلات التنبيه المتعلقة بالأماكن المتابَعة.", save: "حفظ", saved: "تم حفظ التفضيلات", disabled: "إيقاف التنبيهات يلغي الموافقة.", error: "تعذر الحفظ." },
} as const;

export default function ActivityAlertPreferences({ locale, initial }: {
  locale: Locale;
  initial: ActivityAlertSettings;
}) {
  const t = translations[locale];
  const [enabled, setEnabled] = useState(initial.enabled);
  const [threshold, setThreshold] = useState(initial.minIncidents6h);
  const [consent, setConsent] = useState(false);
  const [consentedAt, setConsentedAt] = useState(initial.consentAt);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setMessage("");
    startTransition(async () => {
      try {
        const saved = await runAction(() => saveActivityAlertPreferences({
          enabled,
          minIncidents6h: threshold,
          consent: consent || Boolean(consentedAt),
        }));
        if (!saved) return;
        setEnabled(saved.activityAlerts.enabled);
        setThreshold(saved.activityAlerts.minIncidents6h);
        setConsentedAt(saved.activityAlerts.consentAt);
        setConsent(false);
        setMessage(t.saved);
      } catch {
        setMessage(t.error);
      }
    });
  };

  return (
    <section className="border-t-[1.5px] border-encre pt-6" aria-labelledby="activity-alert-settings">
      <h2 id="activity-alert-settings" className="text-xl font-bold">{t.title}</h2>
      <p className="mt-1 text-sm text-gris">{t.info}</p>
      <div className="mt-4 space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setMessage(""); }} className="h-5 w-5" />
          <span className="font-semibold">{t.enabled}</span>
        </label>
        <label className="block max-w-sm">
          <span className="block text-sm font-semibold">{t.threshold}</span>
          <select className="mt-1 w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-3 py-2"
            value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            {ALERT_THRESHOLDS.map((value) => <option key={value} value={value}>{value.toLocaleString(locale)}</option>)}
          </select>
        </label>
        {enabled && !consentedAt && (
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
            <span className="text-sm">{t.consent}</span>
          </label>
        )}
        <p className="text-xs text-gris">{t.disabled}</p>
        <button type="button" onClick={submit} disabled={pending || (enabled && !consentedAt && !consent)}
          className="min-h-11 rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-2 font-semibold text-papier disabled:opacity-50">
          {t.save}
        </button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>
    </section>
  );
}
