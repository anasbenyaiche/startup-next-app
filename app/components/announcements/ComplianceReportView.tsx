import { getDictionary, type Locale } from "@/lib/i18n";
import type { ComplianceIssue, ComplianceReport, IssueCode } from "@/lib/compliance";

// Rapport de la vérification de conformité : une ligne par règle, cochée ou non,
// avec ce qu'il faut corriger. Affiché après chaque publication et en modération.

// Règle de la liste de contrôle à laquelle se rattache chaque problème.
const GROUP: Record<IssueCode, IssueCode> = {
  required: "required",
  tooLong: "required",
  invalidPosition: "invalidPosition",
  pastDate: "pastDate",
  tooFar: "pastDate",
  endBeforeStart: "pastDate",
  longEvent: "pastDate",
  personalData: "personalData",
  violence: "violence",
  aggressive: "violence",
  insecureLink: "insecureLink",
  shortener: "insecureLink",
  tooManyLinks: "insecureLink",
  shouting: "shouting",
  repeated: "shouting",
  duplicate: "duplicate",
  notDeclared: "notDeclared",
  localRules: "notDeclared",
};

const MARK = {
  ok: { icon: "✓", className: "bg-encre text-papier" },
  info: { icon: "i", className: "bg-bleu text-papier" },
  review: { icon: "!", className: "bg-rose text-encre" },
  block: { icon: "✕", className: "bg-[#c0262d] text-white" },
};

const BANNER = {
  ok: "border-encre bg-papier-fonce",
  review: "border-encre bg-rose/30",
  blocked: "border-[#c0262d] bg-[#c0262d]/10",
};

export default function ComplianceReportView({ report, locale }: { report: ComplianceReport; locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.compliance;
  const fields = dict.create.fields;
  const byGroup = new Map<IssueCode, ComplianceIssue[]>();
  for (const issue of report.issues) byGroup.set(GROUP[issue.code], [...(byGroup.get(GROUP[issue.code]) ?? []), issue]);

  return (
    <section aria-label={t.title} className="space-y-3">
      <p className={`rounded-[3px] border-[1.5px] px-3 py-2.5 font-semibold ${BANNER[report.status]}`} role="status">
        {t.status[report.status]}
      </p>
      <ul className="space-y-2">
        {report.checked.map((code) => {
          const issues = byGroup.get(code) ?? [];
          const worst = issues.find((i) => i.level === "block") ?? issues.find((i) => i.level === "review") ?? issues[0];
          const mark = MARK[worst?.level ?? "ok"];
          return (
            <li key={code} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${mark.className}`}
                aria-label={worst ? t.levels[worst.level] : "OK"}
              >
                {mark.icon}
              </span>
              <div>
                <p className="font-semibold leading-snug">{t.checks[code]}</p>
                {issues.map((i) => (
                  <p key={`${i.code}:${i.field}`} className="text-sm text-encre/80">
                    {i.field && fields[i.field] && i.level !== "info" && <strong>{fields[i.field]} : </strong>}
                    {t.issues[i.code]}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
