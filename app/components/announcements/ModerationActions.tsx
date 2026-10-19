"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { moderate } from "@/app/actions/announcements";
import { getDictionary, type Locale } from "@/lib/i18n";
import { runAction } from "../staleDeployment";

export default function ModerationActions({ id, locale }: { id: string; locale: Locale }) {
  const t = getDictionary(locale).moderation;
  const router = useRouter();
  const [pending, start] = useTransition();
  const decide = (decision: "approve" | "reject") =>
    start(async () => {
      if (await runAction(() => moderate(id, decision))) router.refresh();
    });
  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide("approve")}
        disabled={pending}
        className="rounded-[3px] border-[1.5px] border-encre bg-encre px-3 py-1.5 font-semibold text-papier disabled:opacity-50"
      >
        {t.approve}
      </button>
      <button
        onClick={() => decide("reject")}
        disabled={pending}
        className="rounded-[3px] border-[1.5px] border-[#c0262d] px-3 py-1.5 font-semibold text-[#c0262d] disabled:opacity-50"
      >
        {t.reject}
      </button>
    </div>
  );
}
