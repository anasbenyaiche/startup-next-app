"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toggleFollowCountry, toggleFollowPlace } from "@/app/actions/profile";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import type { ManifestationsResult } from "@/lib/manifestations";
import type { FollowedPlace } from "@/lib/profile";
import { Skeleton } from "../Skeleton";

type Counts = { byCountry: Map<string, number>; byPlace: Map<string, number> };

const row = "flex items-center gap-3 py-2.5";
const unfollowClass = "text-sm text-gris hover:text-encre hover:underline underline-offset-4 disabled:opacity-50";

// Ce que suit l'utilisateur, avec le nombre de manifestations des dernières 24 h.
export default function FollowedLists({
  locale,
  countries: initialCountries,
  places: initialPlaces,
  names,
}: {
  locale: Locale;
  countries: string[];
  places: FollowedPlace[];
  // Noms des pays (code FIPS → nom), calculés côté serveur pour une hydratation stable.
  names: Record<string, string>;
}) {
  const t = getDictionary(locale);
  const p = t.profile;
  const [countries, setCountries] = useState(initialCountries);
  const [places, setPlaces] = useState(initialPlaces);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialCountries.length === 0 && initialPlaces.length === 0) return;
    fetch("/api/manifestations?hours=24")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: ManifestationsResult) => {
        const byCountry = new Map<string, number>();
        const byPlace = new Map<string, number>();
        for (const place of data.places) {
          const n = Object.values(place.byType).reduce((sum, s) => sum + s.incidents, 0);
          byCountry.set(place.country, (byCountry.get(place.country) ?? 0) + n);
          byPlace.set(place.key, n);
        }
        setCounts({ byCountry, byPlace });
      })
      .catch(() => setCounts({ byCountry: new Map(), byPlace: new Map() }));
  }, [initialCountries.length, initialPlaces.length]);

  const count = (n: number | undefined) =>
    counts ? <span className="tabular-nums font-semibold">{(n ?? 0).toLocaleString(locale)}</span> : <Skeleton className="h-4 w-8" />;

  return (
    <>
      <section className="border-t-[1.5px] border-encre pt-6" aria-labelledby="countries">
        <div className="flex items-baseline justify-between">
          <h2 id="countries" className="text-xl font-bold">
            {p.countries}
          </h2>
          {countries.length > 0 && <span className="text-sm text-gris">{p.last24h}</span>}
        </div>
        {countries.length === 0 ? (
          <p className="mt-2 text-gris">{p.noCountries}</p>
        ) : (
          <ul className="mt-2 divide-y divide-encre/15">
            {countries.map((code) => (
              <li key={code} className={row}>
                <Link href={localePath(locale, `/manifestations?pays=${code}`)} className="flex-1 text-lg font-semibold hover:text-bleu hover:underline underline-offset-4">
                  {names[code] ?? code}
                </Link>
                {count(counts?.byCountry.get(code))}
                <button
                  disabled={pending}
                  onClick={() => startTransition(async () => setCountries((await toggleFollowCountry(code)).followedCountries))}
                  className={unfollowClass}
                >
                  {p.unfollow}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t-[1.5px] border-encre pt-6" aria-labelledby="places">
        <div className="flex items-baseline justify-between">
          <h2 id="places" className="text-xl font-bold">
            {p.places}
          </h2>
          {places.length > 0 && <span className="text-sm text-gris">{p.last24h}</span>}
        </div>
        {places.length === 0 ? (
          <p className="mt-2 text-gris">{p.noPlaces}</p>
        ) : (
          <ul className="mt-2 divide-y divide-encre/15">
            {places.map((place) => (
              <li key={place.key} className={row}>
                <Link
                  href={localePath(locale, `/manifestations?pays=${place.country}&lieu=${encodeURIComponent(place.key)}`)}
                  className="flex-1 min-w-0 hover:text-bleu hover:underline underline-offset-4"
                >
                  <span className="block truncate text-lg font-semibold">{place.label.split(",")[0]}</span>
                  <span className="block text-sm text-gris">{names[place.country] ?? place.country}</span>
                </Link>
                {count(counts?.byPlace.get(place.key))}
                <button
                  disabled={pending}
                  onClick={() => startTransition(async () => setPlaces((await toggleFollowPlace(place)).followedPlaces))}
                  className={unfollowClass}
                >
                  {p.unfollow}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
