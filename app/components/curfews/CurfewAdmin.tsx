"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCurfew, removeCurfew } from "@/app/actions/curfews";
import { getDictionary, type Locale } from "@/lib/i18n";
import { runAction } from "../staleDeployment";

const field = "mt-1 w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-2.5 py-2";
const label = "block text-sm font-semibold";

// Formulaire des modérateurs : un couvre-feu recopié d'un arrêté officiel.
export function CurfewForm({
  locale,
  countries,
  timezones,
  defaultCountry,
}: {
  locale: Locale;
  countries: { fips: string; name: string }[];
  timezones: string[];
  defaultCountry: string;
}) {
  const t = getDictionary(locale).curfew.admin;
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    start(async () => {
      const res = await runAction(() => createCurfew(input));
      if (!res) return;
      if (res.ok) {
        form.reset();
        setMessage({ text: t.saved, error: false });
        router.refresh();
      } else {
        const name = res.field ? (t as Record<string, unknown>)[res.field] : null;
        setMessage({ text: res.error === "forbidden" ? t.forbidden : t.invalid(typeof name === "string" ? name : (res.field ?? "")), error: true });
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className={label}>{t.country}</span>
        <select name="country" defaultValue={defaultCountry} className={field}>
          {countries.map((c) => (
            <option key={c.fips} value={c.fips}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t.region}</span>
        <input name="region" required maxLength={80} className={field} />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>{t.area}</span>
        <input name="area" maxLength={200} className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.dailyStart}</span>
        <input name="dailyStart" type="time" required defaultValue="21:00" className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.dailyEnd}</span>
        <input name="dailyEnd" type="time" required defaultValue="06:00" className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.startsOn}</span>
        <input name="startsOn" type="date" required className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.endsOn}</span>
        <input name="endsOn" type="date" className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.timezone}</span>
        <select name="timezone" defaultValue="Europe/Paris" className={field}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t.authority}</span>
        <input name="authority" required maxLength={100} className={field} />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>{t.sourceUrl}</span>
        <input name="sourceUrl" type="url" required placeholder="https://" maxLength={500} className={field} />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>{t.notes}</span>
        <textarea name="notes" rows={2} maxLength={300} className={field} />
      </label>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[3px] border-[1.5px] border-encre bg-encre px-4 py-2 font-semibold text-papier disabled:opacity-50"
        >
          {t.submit}
        </button>
        {message && (
          <p className={`text-sm ${message.error ? "text-[#c0262d]" : ""}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

export function DeleteCurfew({ id, locale }: { id: string; locale: Locale }) {
  const t = getDictionary(locale).curfew.admin;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!window.confirm(t.confirmDelete)) return;
        start(async () => {
          if (await runAction(() => removeCurfew(id))) router.refresh();
        });
      }}
      disabled={pending}
      className="text-sm font-semibold text-[#c0262d] hover:underline underline-offset-4 disabled:opacity-50"
    >
      {t.delete}
    </button>
  );
}
