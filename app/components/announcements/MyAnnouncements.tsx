"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMine } from "@/app/actions/announcements";
import type { Announcement } from "@/lib/announcements";
import { getDictionary, type Locale } from "@/lib/i18n";
import LocalTime from "../LocalTime";
import { runAction } from "../staleDeployment";
import { withNode } from "../withNode";
import ComplianceReportView from "./ComplianceReportView";

const STATUS_STYLE: Record<Announcement["status"], string> = {
  published: "bg-encre text-papier",
  review: "bg-rose text-encre",
  rejected: "bg-[#c0262d] text-white",
};

export default function MyAnnouncements({ items, locale }: { items: Announcement[]; locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.create;
  const router = useRouter();
  const [pending, start] = useTransition();

  if (items.length === 0) return <p className="text-gris">{t.noneYet}</p>;

  const remove = (id: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    start(async () => {
      if (await runAction(() => removeMine(id))) router.refresh();
    });
  };

  return (
    <ul className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="rounded-[3px] border-[1.5px] border-encre p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold leading-snug">{a.title}</p>
              <p className="text-sm text-gris">
                {a.city} ·{" "}
                <LocalTime iso={a.startsAt} locale={locale} options={{ dateStyle: "medium", timeStyle: "short" }} />
              </p>
            </div>
            <span className={`rounded-[3px] px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[a.status]}`}>{t.status[a.status]}</span>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              {dict.compliance.title} ·{" "}
              <span className="font-normal text-gris">
                {withNode(
                  dict.compliance.checkedAt,
                  <LocalTime iso={a.compliance.checkedAt} locale={locale} options={{ dateStyle: "short", timeStyle: "short" }} />,
                )}
              </span>
            </summary>
            <div className="mt-3">
              <ComplianceReportView report={a.compliance} locale={locale} />
            </div>
          </details>
          <button
            onClick={() => remove(a.id)}
            disabled={pending}
            className="mt-3 text-sm font-semibold text-[#c0262d] hover:underline underline-offset-4 disabled:opacity-50"
          >
            {t.delete}
          </button>
        </li>
      ))}
    </ul>
  );
}
