import type { Metadata } from "next";
import Link from "next/link";
import { currentAccount } from "@/auth";
import { RemoveContent, UserActions } from "@/app/components/admin/AdminActions";
import ComplianceReportView from "@/app/components/announcements/ComplianceReportView";
import ModerationActions from "@/app/components/announcements/ModerationActions";
import LocalTime from "@/app/components/LocalTime";
import { withNode } from "@/app/components/withNode";
import { listAccounts, type Account } from "@/lib/users/accounts";
import { auditLog, isEnvAdmin, roleOf } from "@/lib/users/admin";
import { listAlerts } from "@/lib/community/alerts";
import { listForModeration } from "@/lib/community/announcements";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/core/features";
import { countryName, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { listReports } from "@/lib/community/reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).admin.title, robots: { index: false, follow: false } };
}

// Administration de Cortège : comptes (administrateurs), alertes SOS et signalements
// (modérateurs aussi), annonces en relecture (si activées) et journal des actions.
export const dynamic = "force-dynamic";

type Tab = "users" | "sos" | "reports" | "announcements" | "log";
const PAGE_SIZE = 50;

// Icônes recopiées ici : celles des composants SOS et signalements vivent dans des modules client.
const SOS_ICONS: Record<string, string> = { fire: "🔥", looting: "🚨", injured: "🚑" };
const REPORT_ICONS: Record<string, string> = { march: "🚶", gathering: "📢", teargas: "💨", danger: "⚠️", blocked: "🚧" };

const card = "rounded-[4px] border-[1.5px] border-encre p-4";

function matches(a: Account, q: string, filter: string) {
  if (q && !a.email.includes(q.toLowerCase())) return false;
  if (filter === "staff") return !!roleOf(a);
  if (filter === "banned") return !!a.bannedAt;
  if (filter === "unverified") return !a.verifiedAt;
  return true;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [locale, me, params] = await Promise.all([getLocale(), currentAccount(), searchParams]);
  const dict = getDictionary(locale);
  const t = dict.admin;
  const role = roleOf(me);
  const base = localePath(locale, "/startup/moderate");

  if (!me) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
        <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)]">{t.title}</h1>
        <p className="mt-4 text-lg">{t.signIn}</p>
        <Link
          href={`${localePath(locale, "/connexion")}?retour=${encodeURIComponent(base)}`}
          className="mt-6 inline-block rounded-[3px] border-[1.5px] border-encre bg-encre px-5 py-3 font-semibold text-papier"
        >
          {t.signInCta}
        </Link>
      </div>
    );
  }
  // Réservée aux administrateurs : les modérateurs n'y ont pas accès.
  if (role !== "admin") return <p className="mx-auto max-w-xl px-4 sm:px-6 py-16 text-lg">{t.forbidden}</p>;

  const tabs: Tab[] = [
    "users",
    "sos",
    "reports",
    ...(ANNOUNCEMENTS_ENABLED ? (["announcements"] as Tab[]) : []),
    "log",
  ];
  const tab: Tab = tabs.includes(params.onglet as Tab) ? (params.onglet as Tab) : tabs[0];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(2.4rem,7vw,3.6rem)] leading-none">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-encre/85">{t.intro}</p>
        </div>
        <p className="rounded-[3px] bg-encre px-3 py-1.5 text-sm font-semibold text-papier">{t.youAre(t.roles[role])}</p>
      </header>

      <nav aria-label={t.title} className="mt-8 flex flex-wrap gap-1 border-b-[1.5px] border-encre">
        {tabs.map((key) => (
          <Link
            key={key}
            href={`${base}?onglet=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={`-mb-[1.5px] rounded-t-[3px] border-[1.5px] px-4 py-2 font-semibold ${
              key === tab ? "border-encre border-b-papier bg-papier" : "border-transparent text-gris hover:text-encre"
            }`}
          >
            {t.tabs[key]}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "users" && <UsersTab locale={locale} me={me} q={params.q ?? ""} filter={params.filtre ?? "all"} base={base} />}
        {tab === "sos" && <SosTab locale={locale} />}
        {tab === "reports" && <ReportsTab locale={locale} />}
        {tab === "announcements" && <AnnouncementsTab locale={locale} />}
        {tab === "log" && <LogTab locale={locale} />}
      </div>
    </div>
  );
}

async function UsersTab({ locale, me, q, filter, base }: { locale: Locale; me: Account; q: string; filter: string; base: string }) {
  const t = getDictionary(locale).admin;
  const all = await listAccounts();
  const shown = all.filter((a) => matches(a, q.trim(), filter));
  const stats = [
    [all.length, t.stats.accounts],
    [all.filter((a) => a.verifiedAt).length, t.stats.verified],
    [all.filter((a) => roleOf(a)).length, t.stats.staff],
    [all.filter((a) => a.bannedAt).length, t.stats.banned],
  ] as const;
  const date = (iso: string) => <LocalTime iso={iso} locale={locale} options={{ dateStyle: "medium" }} />;

  return (
    <section aria-label={t.tabs.users} className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([n, label]) => (
          <div key={label} className="rounded-[4px] bg-papier-fonce px-4 py-3">
            <dt className="text-sm text-gris">{label}</dt>
            <dd className="display text-3xl tabular-nums">{n.toLocaleString(locale)}</dd>
          </div>
        ))}
      </dl>

      <form action={base} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="onglet" value="users" />
        <label className="flex-1 min-w-[14rem]">
          <span className="text-sm font-semibold">{t.search}</span>
          <input
            name="q"
            type="search"
            defaultValue={q}
            className="mt-1 w-full rounded-[3px] border-[1.5px] border-encre bg-papier px-3 py-2"
          />
        </label>
        <input type="hidden" name="filtre" value={filter} />
        <button className="rounded-[3px] border-[1.5px] border-encre bg-encre px-4 py-2 font-semibold text-papier">{t.searchCta}</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {Object.entries(t.filters).map(([key, label]) => (
          <Link
            key={key}
            href={`${base}?onglet=users&filtre=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold ${
              filter === key ? "border-encre bg-encre text-papier" : "border-encre/30"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-gris">{t.none}</p>
      ) : (
        <ul className="space-y-3">
          {shown.slice(0, PAGE_SIZE).map((a) => {
            const role = roleOf(a);
            const self = a.id === me.id;
            const env = isEnvAdmin(a);
            return (
              <li key={a.id} className={`${card} ${a.bannedAt ? "border-[#c0262d] bg-[#c0262d]/5" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-bold">
                      {a.email}
                      {self && <span className="ms-2 rounded-[3px] bg-rose px-1.5 py-0.5 text-xs text-encre">{t.you}</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-gris">
                      {withNode(t.created, date(a.createdAt))} · {a.providers.map((p) => t.providers[p]).join(", ")} ·{" "}
                      <span className={a.verifiedAt ? "" : "text-[#c0262d]"}>{a.verifiedAt ? t.verified : t.unverified}</span>
                    </p>
                    {a.bannedAt && (
                      <p className="mt-1 text-sm font-semibold text-[#c0262d]">
                        {withNode(t.bannedOn, date(a.bannedAt))}
                        {a.banReason && <span className="font-normal"> · {t.reason} : {a.banReason}</span>}
                      </p>
                    )}
                  </div>
                  {(role || env) && (
                    <span className="rounded-[3px] border-[1.5px] border-encre px-2 py-0.5 text-sm font-semibold">
                      {env ? t.envAdmin : t.roles[role!]}
                    </span>
                  )}
                </div>
                {!self && !env && (
                  <div className="mt-3">
                    <UserActions
                      id={a.id}
                      email={a.email}
                      role={a.role ?? null}
                      banned={!!a.bannedAt}
                      verified={!!a.verifiedAt}
                      locale={locale}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > PAGE_SIZE && <p className="text-sm text-gris">{t.more(shown.length - PAGE_SIZE)}</p>}
    </section>
  );
}

async function SosTab({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.admin;
  const alerts = await listAlerts();
  if (alerts.length === 0) return <p className="text-gris">{t.sosEmpty}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {alerts.map((a) => (
        <li key={a.id} className={`${card} flex items-start justify-between gap-3`}>
          <div>
            <p className="font-bold">
              <span aria-hidden="true">{SOS_ICONS[a.kind]}</span> {dict.sos.kinds[a.kind]}
              {a.demo && <span className="ms-2 text-xs font-normal text-gris">({dict.sos.demo})</span>}
            </p>
            <p className="text-sm text-gris">
              <LocalTime iso={a.createdAt} locale={locale} /> · {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
            </p>
            {a.flags > 0 && <p className="text-sm font-semibold text-[#c0262d]">{t.flags(a.flags)}</p>}
            <a
              href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-bleu hover:underline underline-offset-4"
            >
              {t.seeOnMap}
            </a>
          </div>
          <RemoveContent id={a.id} kind="sos" locale={locale} />
        </li>
      ))}
    </ul>
  );
}

async function ReportsTab({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.admin;
  const reports = await listReports();
  if (reports.length === 0) return <p className="text-gris">{t.reportsEmpty}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {reports.map((r) => (
        <li key={r.id} className={`${card} flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            <p className="font-bold">
              <span aria-hidden="true">{REPORT_ICONS[r.kind]}</span> {dict.reports.kinds[r.kind]}
            </p>
            <p className="text-sm text-gris">
              <LocalTime iso={r.createdAt} locale={locale} /> · {r.confirms} {dict.reports.confirms.other}
            </p>
            {r.flags > 0 && <p className="text-sm font-semibold text-[#c0262d]">{t.flags(r.flags)}</p>}
            {r.videoUrl && (
              <a
                href={r.videoUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block truncate text-sm font-semibold text-bleu hover:underline underline-offset-4"
              >
                {r.videoUrl}
              </a>
            )}
          </div>
          <RemoveContent id={r.id} kind="report" locale={locale} />
        </li>
      ))}
    </ul>
  );
}

async function AnnouncementsTab({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.moderation;
  const items = await listForModeration();
  if (items.length === 0) return <p className="text-gris">{t.empty}</p>;
  return (
    <ul className="space-y-8">
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
  );
}

async function LogTab({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).admin;
  const entries = await auditLog();
  if (entries.length === 0) return <p className="text-gris">{t.logEmpty}</p>;
  return (
    <ol className="divide-y divide-encre/15">
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-3 py-2.5 text-sm">
          <span className="w-40 shrink-0 text-gris tabular-nums">
            <LocalTime iso={e.at} locale={locale} options={{ dateStyle: "short", timeStyle: "short" }} />
          </span>
          <span className="min-w-0 break-all">
            <strong>{e.actor}</strong> {t.actions[e.action] ?? e.action} <strong>{e.target}</strong>
            {e.detail && <span className="text-gris"> · {e.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
