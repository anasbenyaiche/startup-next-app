"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { localePath, type Locale } from "@/lib/i18n";
import { activityForTargets, type WatchTarget, type WatchActivity } from "@/lib/news/watch-activity";
import type { ManifestationsResult } from "@/lib/news/manifestations";
import type { FollowedPlace } from "@/lib/users/profile";

const copy = {
  fr: { title: "Activité de vos suivis", intro: "Couverture médiatique des manifestations signalées par GDELT, et non décompte officiel.", h6: "6 h", h24: "24 h", empty: "Suivez un pays ou un lieu pour voir son activité ici.", loading: "Chargement de l'activité…", error: "Activité temporairement indisponible.", partial: "Données partielles ou anciennes : chiffres indicatifs.", updated: "Dernière mise à jour" },
  en: { title: "Your followed activity", intro: "GDELT media coverage, not an official count of protests.", h6: "6h", h24: "24h", empty: "Follow a country or place to see its activity.", loading: "Loading activity…", error: "Activity temporarily unavailable.", partial: "Partial or older data: indicative figures.", updated: "Last updated" },
  es: { title: "Actividad de tus seguimientos", intro: "Cobertura mediática de GDELT, no un recuento oficial.", h6: "6 h", h24: "24 h", empty: "Sigue un país o lugar para ver su actividad.", loading: "Cargando actividad…", error: "Actividad no disponible temporalmente.", partial: "Datos parciales o antiguos: cifras orientativas.", updated: "Última actualización" },
  pt: { title: "Atividade dos seus favoritos", intro: "Cobertura mediática GDELT, não uma contagem oficial.", h6: "6 h", h24: "24 h", empty: "Siga um país ou local para ver a atividade.", loading: "A carregar atividade…", error: "Atividade temporariamente indisponível.", partial: "Dados parciais ou antigos: valores indicativos.", updated: "Última atualização" },
  de: { title: "Aktivität Ihrer Favoriten", intro: "GDELT-Medienberichte, keine offizielle Protestzählung.", h6: "6 Std.", h24: "24 Std.", empty: "Folgen Sie einem Land oder Ort.", loading: "Aktivität wird geladen…", error: "Aktivität derzeit nicht verfügbar.", partial: "Unvollständige oder ältere Daten: Richtwerte.", updated: "Letzte Aktualisierung" },
  ar: { title: "نشاط الأماكن المتابَعة", intro: "تغطية إعلامية من GDELT وليست إحصاءً رسمياً للاحتجاجات.", h6: "٦ ساعات", h24: "٢٤ ساعة", empty: "تابع بلداً أو مكاناً لعرض نشاطه هنا.", loading: "جارٍ تحميل النشاط…", error: "النشاط غير متاح مؤقتاً.", partial: "بيانات جزئية أو قديمة: أرقام تقريبية.", updated: "آخر تحديث" },
} as const;

export default function FollowedActivity({ locale, countries, places, names }: {
  locale: Locale;
  countries: string[];
  places: FollowedPlace[];
  names: Record<string, string>;
}) {
  const t = copy[locale];
  const targets = useMemo<WatchTarget[]>(() => [
    ...countries.map((country) => ({ id: `country:${country}`, country, label: names[country] ?? country })),
    ...places.map((place) => ({ id: `place:${place.key}`, country: place.country, label: place.label, placeKey: place.key })),
  ], [countries, places, names]);
  const [rows, setRows] = useState<WatchActivity[] | null>(null);
  const [error, setError] = useState(false);
  const [partial, setPartial] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (targets.length === 0) return;
    const controller = new AbortController();
    setRows(null);
    setError(false);
    Promise.all([6, 24].map(async (hours) => {
      const response = await fetch(`/api/manifestations?hours=${hours}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<ManifestationsResult>;
    })).then(([six, day]) => {
      if (controller.signal.aborted) return;
      setRows(activityForTargets(targets, six, day));
      setPartial(Boolean(six.partial || day.partial || six.stale || day.stale));
      setUpdatedAt([six.updatedAt, day.updatedAt].sort()[0]);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [targets]);

  return (
    <section className="border-t-[1.5px] border-encre pt-6" aria-labelledby="followed-activity">
      <h2 id="followed-activity" className="text-xl font-bold">{t.title}</h2>
      <p className="mt-1 text-sm text-gris">{t.intro}</p>
      {targets.length === 0 ? <p className="mt-4 text-gris">{t.empty}</p> :
        error ? <p role="status" className="mt-4 text-gris">{t.error}</p> :
        !rows ? <p role="status" className="mt-4 text-gris">{t.loading}</p> : (
          <>
            {partial && <p role="status" className="mt-3 text-sm text-gris">{t.partial}</p>}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-start">
                <thead><tr className="border-b border-encre/30 text-sm text-gris">
                  <th scope="col" className="py-2 text-start font-medium">{t.title}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t.h6}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t.h24}</th>
                </tr></thead>
                <tbody className="divide-y divide-encre/15">
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pe-3">
                        <Link className="font-semibold hover:text-bleu hover:underline" href={localePath(locale,
                          `/manifestations?pays=${encodeURIComponent(item.country)}${item.placeKey ? `&lieu=${encodeURIComponent(item.placeKey)}` : ""}`)}>
                          {item.label}
                        </Link>
                      </td>
                      <td className="py-3 text-end tabular-nums">{item.sixHours.toLocaleString(locale)}</td>
                      <td className="py-3 text-end tabular-nums">{item.twentyFourHours.toLocaleString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {updatedAt && <p className="mt-3 text-xs text-gris">{t.updated}: {new Date(updatedAt).toLocaleString(locale)}</p>}
          </>
        )}
    </section>
  );
}
