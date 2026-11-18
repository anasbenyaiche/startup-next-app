import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/core/features";
import Link from "next/link";
import { auth } from "@/auth";
import AnnouncementForm from "@/app/components/announcements/AnnouncementForm";
import MyAnnouncements from "@/app/components/announcements/MyAnnouncements";
import { isAdmin } from "@/lib/users/admin";
import { listMine } from "@/lib/community/announcements";
import { FIPS_TO_ISO, isoToFips } from "@/lib/geo/countries";
import { countryName, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/i18n/request";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).create.title, robots: { index: false } };
}

// Un pays par code ISO (plusieurs codes FIPS désignent parfois le même), trié par nom.
function allCountries(locale: Locale) {
  return [...new Set(Object.values(FIPS_TO_ISO))]
    .map((iso) => isoToFips(iso))
    .filter((fips): fips is string => !!fips)
    .map((fips) => ({ fips, name: countryName(locale, fips, fips) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

const section = "border-t-[1.5px] border-encre pt-6";

export default async function CreatePage() {
  if (!ANNOUNCEMENTS_ENABLED) notFound();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.create;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
        <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{t.signInTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-encre/85">{t.signInText}</p>
        <Link
          href={`${localePath(locale, "/connexion")}?retour=${encodeURIComponent(localePath(locale, "/startup/create"))}`}
          className="mt-8 inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 text-lg font-semibold text-papier shadow-[4px_4px_0_rgb(var(--rose))] hover:bg-bleu hover:border-bleu"
        >
          {t.signInCta}
        </Link>
      </div>
    );
  }

  const [visitorIso, mine, admin] = await Promise.all([getVisitorCountry(), listMine(userId), isAdmin()]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 grid gap-12 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8 min-w-0">
        <header>
          <h1 className="display text-[clamp(2.4rem,7vw,3.8rem)]">{t.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-encre/85 max-w-[60ch]">{t.intro}</p>
        </header>
        <AnnouncementForm
          locale={locale}
          countries={allCountries(locale)}
          defaultCountry={visitorIso ? isoToFips(visitorIso) : null}
        />
        <section className={section}>
          <h2 className="text-xl font-bold mb-4">{t.mine}</h2>
          <MyAnnouncements items={mine} locale={locale} />
        </section>
      </div>

      <aside className="space-y-6 lg:pt-4">
        <section className="rounded-[3px] border-[1.5px] border-encre bg-papier-fonce p-5 shadow-[4px_4px_0_rgb(var(--encre))]">
          <h2 className="font-bold">{t.rules}</h2>
          <ol className="mt-3 space-y-2 text-sm leading-snug list-decimal ps-4">
            {t.rulesList.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </section>
        <section className="text-sm text-gris leading-relaxed">
          <h2 className="font-bold text-encre">{dict.compliance.title}</h2>
          <p className="mt-1">{dict.announcements.disclaimer}</p>
        </section>
        {admin && (
          <Link href={localePath(locale, "/startup/moderate")} className="inline-block font-semibold text-bleu hover:underline underline-offset-4">
            {dict.moderation.title} →
          </Link>
        )}
      </aside>
    </div>
  );
}
