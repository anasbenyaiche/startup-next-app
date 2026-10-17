import type { Metadata } from "next";
import Image from "next/image";
import { auth } from "@/auth";
import { signInToFollow } from "@/app/actions/profile";
import DeleteMyData from "@/app/components/profile/DeleteMyData";
import FollowedLists from "@/app/components/profile/FollowedLists";
import PreferencesForm from "@/app/components/profile/PreferencesForm";
import { FIPS_TO_ISO, isoToFips } from "@/lib/countries";
import { countryName, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/profile";

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
        <form
          action={async () => {
            "use server";
            await signInToFollow(localePath(locale, "/profil"));
          }}
        >
          <button
            type="submit"
            className="mt-8 rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu"
          >
            {t.signInCta}
          </button>
        </form>
        <p className="mt-8 text-sm text-gris">{t.privateNote}</p>
      </div>
    );
  }

  const profile = await getProfile(user.id);
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
          <p className="text-sm text-gris">
            {t.memberSince(new Date(profile.createdAt).toLocaleDateString(locale, { dateStyle: "long" }))}
          </p>
        </div>
      </header>
      <p className="text-encre/85 max-w-[60ch]">{t.privateNote}</p>

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
        <p className="mt-1 text-encre/85 max-w-[60ch]">{t.dataText}</p>
        <DeleteMyData locale={locale} />
      </section>
    </div>
  );
}
