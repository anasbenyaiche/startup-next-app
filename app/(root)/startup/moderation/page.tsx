import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/features";
import ComplianceReportView from "@/app/components/announcements/ComplianceReportView";
import ModerationActions from "@/app/components/announcements/ModerationActions";
import LocalTime from "@/app/components/LocalTime";
import { isAdmin } from "@/lib/admin";
import { listForModeration } from "@/lib/announcements";
import { countryName, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).moderation.title, robots: { index: false } };
}

// Annonces en relecture (vérification « à relire » ou plusieurs signalements d'abus).
export default async function ModerationPage() {
  if (!ANNOUNCEMENTS_ENABLED) notFound();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.moderation;

  if (!(await isAdmin())) {
    return <p className="mx-auto max-w-xl px-4 sm:px-6 py-16 text-lg">{t.forbidden}</p>;
  }

  const items = await listForModeration();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{t.title}</h1>
      <p className="mt-3 text-lg text-encre/85">{t.intro}</p>
      {items.length === 0 ? (
        <p className="mt-10 text-gris">{t.empty}</p>
      ) : (
        <ul className="mt-10 space-y-8">
          {items.map((a) => (
            <li key={a.id} className="rounded-[3px] border-[1.5px] border-encre p-5 space-y-4">
              <header>
                <p className="text-sm text-gris">
                  {dict.create.kinds[a.kind]} · {a.city}, {countryName(locale, a.country, a.country)} ·{" "}
                  <LocalTime iso={a.startsAt} locale={locale} options={{ dateStyle: "medium", timeStyle: "short" }} />
                </p>
                <h2 className="text-xl font-bold leading-snug">{a.title}</h2>
                {a.flags > 0 && <p className="text-sm font-semibold text-[#c0262d]">{t.flags(a.flags)}</p>}
              </header>
              {a.description && <p className="whitespace-pre-line text-encre/85">{a.description}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-gris">{dict.announcements.where}</dt>
                <dd>{a.meetingPoint}</dd>
                {a.organizer && (
                  <>
                    <dt className="text-gris">{dict.announcements.organizer}</dt>
                    <dd>{a.organizer}</dd>
                  </>
                )}
                {a.sourceUrl && (
                  <>
                    <dt className="text-gris">{dict.create.fields.sourceUrl}</dt>
                    <dd className="break-all">{a.sourceUrl}</dd>
                  </>
                )}
              </dl>
              <ComplianceReportView report={a.compliance} locale={locale} />
              <ModerationActions id={a.id} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
