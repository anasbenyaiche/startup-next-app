"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FIPS_TO_ISO } from "@/lib/geo/countries";
import { COUNTRY_SEGMENT, countryName, getDictionary, localePath, type Locale } from "@/lib/i18n";
import type { ManifestationsResult } from "@/lib/news/manifestations";
import LocalTime from "./LocalTime";
import { LoadingRegion, SKELETON_WIDTHS, Skeleton } from "./Skeleton";
import { withNode } from "./withNode";

type CountryCount = { code: string; name: string; count: number; href?: string };

type Initial = { updatedAt: string; countries: CountryCount[] } | null;

// Pays où la presse signale le plus de manifestations sur les 6 dernières heures,
// plus le pays du visiteur s'il n'est pas dans le haut du classement.
export default function LiveCountries({
  locale,
  visitorFips,
  initial,
}: {
  locale: Locale;
  visitorFips: string | null;
  // Classement déjà calculé par le serveur (données en cache), sinon chargé ici.
  initial: Initial;
}) {
  const t = getDictionary(locale).home;
  const [all, setAll] = useState<CountryCount[] | null>(initial?.countries ?? null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetch("/api/manifestations?hours=6")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: ManifestationsResult) => {
          if (cancelled) return;
          // Période encore incomplète : affichage de ce qui est lu, puis on complète.
          if (data.partial) retry = setTimeout(load, 1000);
          const byCountry = new Map<string, CountryCount>();
          for (const p of data.places) {
            const c = byCountry.get(p.country) ?? { code: p.country, name: p.countryName, count: 0 };
            for (const n of Object.values(p.byType)) c.count += n.incidents;
            byCountry.set(p.country, c);
          }
          setAll([...byCountry.values()].sort((a, b) => b.count - a.count));
          setUpdatedAt(data.updatedAt);
        })
        .catch(() => !cancelled && setError(true));
    load();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique si le serveur n'a rien fourni
  }, []);

  if (error) return <p className="text-gris">{t.unreachable}</p>;
  if (!all) {
    // Même grille que le classement : nom, nombre, jauge.
    return (
      <LoadingRegion label={t.loading}>
        <ol className="divide-y divide-encre/15 border-y-[1.5px] border-encre">
          {SKELETON_WIDTHS.slice(0, 8).map((w, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-2.5">
              <span className="flex h-7 items-center">
                <Skeleton className="h-4" style={{ width: w }} />
              </span>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="col-span-2 mt-1.5 h-[3px]" style={{ width: `${100 - i * 9}%` }} />
            </li>
          ))}
        </ol>
        <Skeleton className="mt-4 h-3.5 w-32" />
      </LoadingRegion>
    );
  }
  if (all.length === 0) return <p className="text-gris">{t.empty}</p>;

  const top = all.slice(0, 8);
  const max = top[0].count;
  const visitor = visitorFips ? all.find((c) => c.code === visitorFips) : undefined;
  const fmt = (n: number) => n.toLocaleString(locale);
  // Noms et liens fournis par le serveur quand il a rendu le classement (pour une
  // hydratation identique) ; sinon calculés ici, avec un lien par code ISO que la
  // page pays redirige vers son adresse lisible.
  const name = (c: CountryCount) => (initial ? c.name : countryName(locale, c.code, c.name));
  const href = (c: CountryCount) =>
    c.href ?? localePath(locale, `/${COUNTRY_SEGMENT[locale]}/${(FIPS_TO_ISO[c.code] ?? c.code).toLowerCase()}`);

  return (
    <>
      <ol className="divide-y divide-encre/15 border-y-[1.5px] border-encre">
        {top.map((c) => (
          <li key={c.code}>
            <Link
              href={href(c)}
              className="group grid grid-cols-[1fr_auto] items-center gap-x-4 py-2.5 hover:text-bleu"
            >
              <span className="text-lg font-semibold group-hover:underline underline-offset-4">
                {name(c)}
                {c.code === visitorFips && <span className="live-dot ms-2 align-middle" aria-hidden="true" />}
              </span>
              <span className="tabular-nums text-gris">{fmt(c.count)}</span>
              {/* Barre proportionnelle : même encre, aucune couleur de plus. */}
              <span className="col-span-2 mt-1.5 h-[3px] bg-encre/10">
                <span
                  className="block h-full bg-gris/70 group-hover:bg-bleu"
                  style={{ width: `${(c.count / max) * 100}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {visitorFips && !top.some((c) => c.code === visitorFips) && (
        <p className="mt-4">
          <span className="text-gris">{t.yourCountry} </span>
          {visitor ? (
            <Link href={href(visitor)} className="font-semibold hover:text-bleu hover:underline underline-offset-4">
              {name(visitor)}, {fmt(visitor.count)}
            </Link>
          ) : (
            <span>{t.nothingInYourCountry}</span>
          )}
        </p>
      )}

      {updatedAt && (
        <p className="mt-3 text-sm text-gris">
          {withNode(t.updatedAt, <LocalTime iso={updatedAt} locale={locale} />)}
        </p>
      )}
    </>
  );
}
