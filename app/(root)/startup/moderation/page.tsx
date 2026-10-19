import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

// Ancienne adresse de l'administration : renvoie vers /startup/moderate.
export default async function OldModerationPage() {
  redirect(localePath(await getLocale(), "/startup/moderate"));
}
