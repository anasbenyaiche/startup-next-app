"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMyData } from "@/app/actions/profile";
import { getDictionary, type Locale } from "@/lib/i18n";
import { runAction } from "../staleDeployment";

export default function DeleteMyData({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).profile;
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) return <p role="status" className="font-semibold">{t.deleted}</p>;
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.deleteConfirm)) return;
        startTransition(async () => {
          await runAction(() => deleteMyData().then(() => true));
          setDone(true);
          router.refresh();
        });
      }}
      className="rounded-[3px] border-[1.5px] border-[#c0262d] px-4 py-2 font-semibold text-[#c0262d] hover:bg-[#c0262d] hover:text-papier disabled:opacity-60"
    >
      {t.delete}
    </button>
  );
}
