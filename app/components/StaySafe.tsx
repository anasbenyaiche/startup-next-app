import Link from "next/link";
import { emergencyNumbers } from "@/lib/emergency";
import { countryName, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { isoToFips } from "@/lib/countries";

// « Stay safe » : conseils avant, pendant et après une manifestation, et numéros
// d'urgence du pays du visiteur. Bandeau encre, comme un panneau tenu dans le cortège.
export default function StaySafe({ locale, visitorIso }: { locale: Locale; visitorIso: string | null }) {
  const dict = getDictionary(locale);
  const t = dict.safety;
  const numbers = emergencyNumbers(visitorIso);
  const fips = visitorIso ? isoToFips(visitorIso) : null;

  return (
    <section aria-labelledby="stay-safe" className="mt-24 bg-encre text-papier">
      {/* Le ruban penché reprend la banderole du haut de page, en sens inverse. */}
      <div className="-mx-4 rotate-1 -translate-y-6 overflow-hidden bg-rose border-y-[3px] border-encre px-8 py-3">
        <p className="display whitespace-nowrap text-center text-encre text-[clamp(2rem,6vw,4.5rem)] leading-none" aria-hidden="true">
          {t.eyebrow} · {t.eyebrow} · {t.eyebrow}
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-16 pt-6">
        <header className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose">{t.eyebrow}</p>
          <h2 id="stay-safe" className="display mt-2 text-[clamp(2.2rem,6vw,3.6rem)]">
            {t.title}
          </h2>
          <p className="mt-3 text-lg text-papier/80">{t.intro}</p>
        </header>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {t.steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-[3px] border-[1.5px] border-papier bg-papier p-5 text-encre shadow-[5px_5px_0_rgb(var(--rose))]"
            >
              <p className="flex items-baseline gap-3">
                <span className="display text-[2.6rem] leading-none text-bleu tabular-nums" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xl font-bold">{step.title}</span>
              </p>
              <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-snug">
                {step.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-rose" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
          <section aria-labelledby="urgences" className="rounded-[3px] border-[1.5px] border-dashed border-papier/60 p-5">
            <h3 id="urgences" className="font-bold">
              {t.emergency}
              {numbers && fips && <span className="font-normal text-papier/70"> · {countryName(locale, fips, visitorIso!)}</span>}
            </h3>
            {numbers ? (
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                {numbers.map((n) => (
                  <li key={`${n.number}-${n.kind}`}>
                    <a href={`tel:${n.number}`} className="display block text-[2.4rem] leading-none text-rose hover:underline underline-offset-4">
                      {n.number}
                    </a>
                    <span className="text-sm text-papier/80">{t.emergencyKinds[n.kind]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-papier/80">{t.emergencyFallback}</p>
            )}
          </section>

          <div>
            <p className="text-lg leading-relaxed text-papier/90">{t.rights}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={localePath(locale, "/manifestations")}
                className="rounded-[3px] border-[1.5px] border-papier bg-papier px-4 py-2.5 font-semibold text-encre hover:bg-rose hover:border-rose"
              >
                {t.ctaMap}
              </Link>
              <Link
                href={localePath(locale, "/startup/create")}
                className="rounded-[3px] border-[1.5px] border-papier px-4 py-2.5 font-semibold hover:bg-papier hover:text-encre"
              >
                {t.ctaCreate}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
