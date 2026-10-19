import Link from "next/link";
import type { AlertKind } from "@/lib/alerts";
import { getDictionary, localePath, plural, type Locale } from "@/lib/i18n";

const ICONS: Record<AlertKind, string> = { fire: "🔥", looting: "🚨", injured: "🚑" };
const KINDS: AlertKind[] = ["fire", "looting", "injured"];

// « SOS et entraide » sur l'accueil : à quoi sert le bouton SOS, et combien d'alertes sont actives.
export default function SosHome({ locale, activeCount }: { locale: Locale; activeCount: number }) {
  const t = getDictionary(locale).sos;
  return (
    <section aria-labelledby="sos-accueil" className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
      <div className="grid gap-8 rounded-[6px] border-[2px] border-encre bg-papier p-6 shadow-[6px_6px_0_#c0262d] sm:p-8 md:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="sos-dot" aria-hidden="true">
            <span className="text-xs font-black text-white">{t.button}</span>
          </span>
          <h2 id="sos-accueil" className="display mt-3 text-[clamp(2.2rem,6vw,3.4rem)] leading-none">
            {t.homeTitle}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-encre/85">{t.homeText}</p>
          <ol className="mt-5 space-y-2">
            {t.homeSteps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="display text-xl leading-tight text-[#c0262d] tabular-nums">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col justify-between gap-6">
          <ul className="grid grid-cols-3 gap-2.5">
            {KINDS.map((kind) => (
              <li key={kind} className={`sos-choice-${kind} rounded-[6px] border-[2px] border-encre px-2 py-4 text-center`}>
                <span className="block text-[2.4rem] leading-none" aria-hidden="true">
                  {ICONS[kind]}
                </span>
                <span className="mt-1 block font-bold leading-tight">{t.kinds[kind]}</span>
              </li>
            ))}
          </ul>
          <div>
            <p className="flex items-center gap-2 font-semibold" role="status">
              {activeCount > 0 ? (
                <>
                  <span className="live-dot" aria-hidden="true" />
                  <span className="text-[#c0262d]">
                    {activeCount.toLocaleString(locale)} {plural(locale, activeCount, t.active)}
                  </span>
                </>
              ) : (
                <span className="text-gris">{t.homeNone}</span>
              )}
            </p>
            <Link
              href={localePath(locale, "/manifestations")}
              className="mt-3 inline-block rounded-[4px] border-[2px] border-encre bg-[#c0262d] px-5 py-3 text-lg font-bold text-white shadow-[4px_4px_0_rgb(var(--encre))] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_rgb(var(--encre))]"
            >
              {t.homeCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
