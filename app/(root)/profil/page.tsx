import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import DeleteMyData from "@/app/components/profile/DeleteMyData";
import FollowedLists from "@/app/components/profile/FollowedLists";
import PreferencesForm from "@/app/components/profile/PreferencesForm";
import { FIPS_TO_ISO, isoToFips } from "@/lib/countries";
import { countryName, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/profile";
import { currentRole } from "@/lib/admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${getDictionary(await getLocale()).profile.title}, Cortège`, robots: { index: false } };
}

const section = "border-t-[1.5px] border-encre pt-6";

// Un pays par code ISO (plusieurs codes FIPS désignent parfois le même), trié par nom.
function allCountries(locale: Locale) {
  return [...new Set(Object.values(FIPS_TO_ISO))]
    .map((iso) => isoToFips(iso))
    .filter((fips): fips is string => !!fips)
    .map((fips) => ({ fips, name: countryName(locale, fips, fips) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export default async function ProfilePage() {
  const locale = await getLocale();
  const t = getDictionary(locale).profile;
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
        <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{t.signInTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-encre/85">{t.signInText}</p>
        <Link
          href={`${localePath(locale, "/connexion")}?retour=${encodeURIComponent(localePath(locale, "/profil"))}`}
          className="mt-8 inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu"
        >
          {t.signInCta}
        </Link>
        <p className="mt-8 text-sm text-gris">{t.privateNote}</p>
      </div>
    );
  }

  const [profile, role] = await Promise.all([getProfile(user.id), currentRole()]);
  const countries = allCountries(locale);
  const names: Record<string, string> = {};
  for (const code of [...profile.followedCountries, ...profile.followedPlaces.map((p) => p.country)]) {
    names[code] = countryName(locale, code, code);
  }
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-10">
      <header className="flex items-center gap-4">
        {user.image && (
          <Image src={user.image} alt="" width={64} height={64} className="rounded-full border-[1.5px] border-encre" />
        )}
        <div>
          <h1 className="display text-[clamp(2.2rem,6vw,3.2rem)]">{user.name ?? t.title}</h1>
          {user.email && <p className="text-encre/80">{user.email}</p>}
          <p className="text-sm text-gris">
            {t.memberSince(new Date(profile.createdAt).toLocaleDateString(locale, { dateStyle: "long" }))}
          </p>
        </div>
      </header>
      <p className="text-encre/85 max-w-[60ch]">{t.privateNote}</p>
      {/* Accès à l'administration pour l'équipe : sur mobile, le lien du menu est masqué faute de place. */}
      {role && (
        <Link
          href={localePath(locale, "/startup/moderation")}
          className="inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-4 py-2 font-semibold text-papier"
        >
          {getDictionary(locale).admin.nav} · {getDictionary(locale).admin.roles[role]}
        </Link>
      )}

      <FollowedLists
        locale={locale}
        countries={profile.followedCountries}
        places={profile.followedPlaces}
        names={names}
      />

      <section className={section} aria-labelledby="prefs">
        <h2 id="prefs" className="text-xl font-bold">
          {t.prefs}
        </h2>
        <p className="mt-1 text-sm text-gris max-w-[60ch]">{t.prefsHint}</p>
        <PreferencesForm
          locale={locale}
          initial={{
            defaultHours: profile.defaultHours,
            defaultCountry: profile.defaultCountry,
            cityOnly: profile.cityOnly,
            multiSource: profile.multiSource,
          }}
          followed={profile.followedCountries.map((fips) => ({ fips, name: names[fips] }))}
          countries={countries}
        />
      </section>

      <section className={section} aria-labelledby="data">
        <h2 id="data" className="text-xl font-bold">
          {t.data}
        </h2>
        <p className="mt-1 text-encre/85 max-w-[60ch]">
          {t.dataText}{" "}
          <Link href={localePath(locale, "/legal/confidentialite")} className="text-bleu underline underline-offset-4">
            {getDictionary(locale).legal.privacy}
          </Link>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Lien simple : le navigateur télécharge le fichier renvoyé par la route. */}
          <a
            href="/api/profile/export"
            download
            className="rounded-[3px] border-[1.5px] border-encre px-4 py-2 font-semibold hover:bg-encre hover:text-papier"
          >
            {getDictionary(locale).legal.exportData}
          </a>
          <DeleteMyData locale={locale} />
        </div>
      </section>
    </div>
  );
}
