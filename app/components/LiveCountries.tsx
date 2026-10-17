"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ManifestationsResult } from "@/lib/manifestations";

type CountryCount = { code: string; name: string; count: number };

// Pays où la presse signale le plus de manifestations sur les 6 dernières heures.
export default function LiveCountries() {
  const [countries, setCountries] = useState<CountryCount[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/manifestations?hours=6")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: ManifestationsResult) => {
        const byCountry = new Map<string, CountryCount>();
        for (const p of data.places) {
          const c = byCountry.get(p.country) ?? { code: p.country, name: p.countryName, count: 0 };
          for (const t of Object.values(p.byType)) c.count += t.count;
          byCountry.set(p.country, c);
        }
        setCountries([...byCountry.values()].sort((a, b) => b.count - a.count).slice(0, 8));
        setUpdatedAt(data.updatedAt);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <p className="text-gris">
        Les données de la presse sont injoignables pour l&apos;instant. Réessayez dans quelques minutes.
      </p>
    );
  }
  if (!countries) return <p className="text-gris">Chargement des 6 dernières heures…</p>;
  if (countries.length === 0) return <p className="text-gris">Aucune manifestation signalée ces 6 dernières heures.</p>;

  const max = countries[0].count;
  return (
    <>
      <ol className="divide-y divide-encre/15 border-y-[1.5px] border-encre">
        {countries.map((c) => (
          <li key={c.code}>
            <Link
              href={`/manifestations?pays=${c.code}`}
              className="group grid grid-cols-[1fr_auto] items-center gap-x-4 py-2.5 hover:text-bleu"
            >
              <span className="text-lg font-semibold group-hover:underline underline-offset-4">{c.name}</span>
              <span className="tabular-nums text-gris">{c.count.toLocaleString("fr-FR")}</span>
              {/* Barre proportionnelle : même encre, aucune couleur de plus. */}
              <span className="col-span-2 mt-1.5 h-[3px] bg-encre/10">
                <span className="block h-full bg-gris/70 group-hover:bg-bleu" style={{ width: `${(c.count / max) * 100}%` }} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {updatedAt && (
        <p className="mt-3 text-sm text-gris">
          Mis à jour à {new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </>
  );
}
