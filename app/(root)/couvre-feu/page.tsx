import type { Metadata } from "next";
import Link from "next/link";
import { CurfewForm, DeleteCurfew } from "@/app/components/curfews/CurfewAdmin";
import Footer from "@/app/components/Footer";
import { isAdmin } from "@/lib/admin";
import { FIPS_TO_ISO, isoToFips } from "@/lib/countries";
import { curfewStatus, listCurfews, type Curfew, type CurfewStatus } from "@/lib/curfews";
import { countryName, getDictionary, localePath, plural, type Locale } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/locale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale).curfew;
  return pageMetadata({ locale, path: (l) => localePath(l, "/couvre-feu"), title: t.title, description: t.intro });
}

// Les états dépendent de l'heure : la page est recalculée à chaque visite.
export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<CurfewStatus["kind"], number> = { active: 0, tonight: 1, upcoming: 2, ended: 3 };

function allCountries(locale: Locale) {
  return [...new Set(Object.values(FIPS_TO_ISO))]
    .map((iso) => isoToFips(iso))
    .filter((fips): fips is string => !!fips)
    .map((fips) => ({ fips, name: countryName(locale, fips, fips) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

function StatusBadge({ status, locale }: { status: CurfewStatus; locale: Locale }) {
  const t = getDictionary(locale).curfew.status;
  // Dates des arrêtés : jours civils, formatés sans décalage de fuseau.
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "UTC" });
  if (status.kind === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-[3px] bg-[#c0262d] px-2.5 py-1 text-sm font-bold text-white">
        <span className="live-dot" aria-hidden="true" />
        {t.active(status.until)}
      </span>
    );
  }
  if (status.kind === "tonight") {
    return <span className="rounded-[3px] bg-rose px-2.5 py-1 text-sm font-bold text-encre">{t.tonight(status.from)}</span>;
  }
  if (status.kind === "upcoming") {
    return (
      <span className="rounded-[3px] border-[1.5px] border-encre px-2.5 py-1 text-sm font-semibold">
        {t.upcoming(day(status.on), status.from)}
      </span>
    );
  }
  return <span className="rounded-[3px] bg-papier-fonce px-2.5 py-1 text-sm text-gris">{t.ended}</span>;
}

export default async function CurfewPage({ searchParams }: { searchParams: Promise<{ pays?: string }> }) {
  const [locale, admin, visitorIso, params] = await Promise.all([getLocale(), isAdmin(), getVisitorCountry(), searchParams]);
  const dict = getDictionary(locale);
  const t = dict.curfew;
  const now = new Date();
  const curfews = await listCurfews(now);
  const selected = params.pays?.toUpperCase() ?? null;
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  // Regroupement par pays puis par région, les couvre-feux en vigueur d'abord.
  const withStatus = curfews.map((c) => ({ c, status: curfewStatus(c, now) }));
  const countries = [...new Set(withStatus.map((x) => x.c.country))]
    .map((fips) => ({ fips, name: countryName(locale, fips, fips) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const shown = withStatus
    .filter((x) => !selected || x.c.country === selected)
    .sort((a, b) => STATUS_ORDER[a.status.kind] - STATUS_ORDER[b.status.kind] || a.c.region.localeCompare(b.c.region, locale));
  const byCountry = new Map<string, { c: Curfew; status: CurfewStatus }[]>();
  for (const x of shown) byCountry.set(x.c.country, [...(byCountry.get(x.c.country) ?? []), x]);
  const activeCount = withStatus.filter((x) => x.status.kind === "active").length;

  const chip = "rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold";
  const base = localePath(locale, "/couvre-feu");

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        <header className="max-w-3xl">
          <h1 className="display text-[clamp(2.4rem,7vw,4rem)] leading-none">{t.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-encre/85">{t.intro}</p>
          {activeCount > 0 && (
            <p className="mt-4 inline-flex items-center gap-2 font-bold text-[#c0262d]" role="status">
              <span className="live-dot" aria-hidden="true" />
              {t.activeNow} · {activeCount.toLocaleString(locale)} {plural(locale, activeCount, t.count)}
            </p>
          )}
        </header>

        {countries.length > 0 && (
          <nav aria-label={t.allCountries} className="mt-8 flex flex-wrap gap-2">
            <Link href={base} className={`${chip} ${!selected ? "border-encre bg-encre text-papier" : "border-encre/30"}`}>
              {t.allCountries}
            </Link>
            {countries.map((c) => (
              <Link
                key={c.fips}
                href={`${base}?pays=${c.fips}`}
                className={`${chip} ${selected === c.fips ? "border-encre bg-encre text-papier" : "border-encre/30"}`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}

        {shown.length === 0 ? (
          <p className="mt-10 rounded-[4px] border-[1.5px] border-dashed border-encre/40 p-6 text-gris">
            {selected ? t.emptyCountry : t.empty}
          </p>
        ) : (
          <div className="mt-10 space-y-10">
            {[...byCountry.entries()].map(([fips, items]) => (
              <section key={fips} aria-labelledby={`pays-${fips}`}>
                <h2 id={`pays-${fips}`} className="text-2xl font-bold">
                  {countryName(locale, fips, fips)}
                </h2>
                <ul className="mt-4 grid gap-4 md:grid-cols-2">
                  {items.map(({ c, status }) => (
                    <li
                      key={c.id}
                      className={`rounded-[4px] border-[1.5px] p-5 ${
                        status.kind === "active"
                          ? "border-[#c0262d] shadow-[4px_4px_0_#c0262d]"
                          : "border-encre shadow-[4px_4px_0_rgb(var(--encre))]"
                      } ${status.kind === "ended" ? "opacity-60" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-xl font-bold leading-snug">{c.region}</h3>
                        <StatusBadge status={status} locale={locale} />
                      </div>
                      {c.area && (
                        <p className="mt-1 text-sm">
                          <span className="text-gris">{t.area} : </span>
                          {c.area}
                        </p>
                      )}
                      <p className="display mt-3 text-[1.8rem] leading-none tabular-nums">{t.hours(c.dailyStart, c.dailyEnd)}</p>
                      <p className="mt-2 text-sm">
                        {c.endsOn ? t.periodUntil(day(c.startsOn), day(c.endsOn)) : `${t.period(day(c.startsOn))}, ${t.untilFurther}`}
                      </p>
                      {c.notes && <p className="mt-2 text-sm text-encre/80">{c.notes}</p>}
                      <p className="mt-3 text-sm text-gris">
                        {t.authority} {c.authority}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-bleu hover:underline underline-offset-4"
                        >
                          {t.source} ↗
                        </a>
                        {admin && <DeleteCurfew id={c.id} locale={locale} />}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-10 max-w-3xl text-sm text-gris leading-relaxed">{t.disclaimer}</p>

        {admin && (
          <section className="mt-12 border-t-[1.5px] border-encre pt-8">
            <h2 className="text-xl font-bold">{t.admin.title}</h2>
            <p className="mt-1 mb-5 text-sm text-gris">{t.admin.hint}</p>
            <CurfewForm
              locale={locale}
              countries={allCountries(locale)}
              timezones={Intl.supportedValuesOf("timeZone")}
              defaultCountry={(visitorIso && isoToFips(visitorIso)) || "FR"}
            />
          </section>
        )}
      </div>
      <Footer locale={locale} />
    </>
  );
}
