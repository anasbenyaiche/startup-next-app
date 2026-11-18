"use client";

import { useState, useTransition } from "react";
import { savePreferences } from "@/app/actions/profile";
import { getDictionary, type Locale } from "@/lib/i18n";
import { runAction } from "../staleDeployment";
import type { Profile } from "@/lib/users/profile";

type Prefs = Pick<Profile, "defaultHours" | "defaultCountry" | "cityOnly" | "multiSource">;

// Les noms de pays sont calculés une fois, côté serveur : Node et le navigateur
// n'ont pas exactement les mêmes traductions, ce qui casserait l'hydratation.
export type CountryOption = { fips: string; name: string };

export default function PreferencesForm({
  locale,
  initial,
  followed,
  countries,
}: {
  locale: Locale;
  initial: Prefs;
  followed: CountryOption[];
  countries: CountryOption[];
}) {
  const t = getDictionary(locale);
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<Prefs>) => {
    setSaved(false);
    setPrefs((p) => ({ ...p, ...patch }));
  };

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          if (await runAction(() => savePreferences(prefs))) setSaved(true);
        });
      }}
    >
      <label className="block max-w-sm">
        <span className="text-sm text-gris">{t.profile.defaultCountry}</span>
        <select
          value={prefs.defaultCountry ?? ""}
          onChange={(e) => update({ defaultCountry: e.target.value || null })}
          className="mt-1 w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-2.5 py-2 font-semibold"
        >
          <option value="">{t.profile.visitorCountry}</option>
          {followed.length > 0 && (
            <optgroup label={t.follow.yourFollows}>
              {followed.map((c) => (
                <option key={`f-${c.fips}`} value={c.fips}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={t.map.allCountries}>
            {countries.map((c) => (
              <option key={c.fips} value={c.fips}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <fieldset>
        <legend className="text-sm text-gris mb-1">{t.profile.defaultPeriod}</legend>
        <div className="grid grid-cols-3 max-w-xs rounded-[3px] border-[1.5px] border-encre overflow-hidden">
          {[6, 24, 72].map((h) => (
            <button
              type="button"
              key={h}
              onClick={() => update({ defaultHours: h })}
              aria-pressed={prefs.defaultHours === h}
              className={`py-1.5 font-semibold [&:not(:first-child)]:border-s-[1.5px] border-encre ${
                prefs.defaultHours === h ? "bg-encre text-papier" : "hover:bg-papier-fonce"
              }`}
            >
              {h} h
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.cityOnly}
            onChange={(e) => update({ cityOnly: e.target.checked })}
            className="accent-[rgb(var(--encre))]"
          />
          {t.filters.cityOnly}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.multiSource}
            onChange={(e) => update({ multiSource: e.target.checked })}
            className="accent-[rgb(var(--encre))]"
          />
          {t.filters.multiSource}
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[3px] border-[1.5px] border-encre bg-encre px-4 py-2 font-semibold text-papier hover:bg-bleu hover:border-bleu disabled:opacity-60"
        >
          {t.profile.save}
        </button>
        <p role="status" className="text-sm text-gris">
          {saved ? t.profile.saved : ""}
        </p>
      </div>
    </form>
  );
}
