import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthPanel, { type AuthView } from "@/app/components/auth/AuthPanel";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { safeReturnPath } from "@/lib/core/return-path";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).auth.title, robots: { index: false } };
}

const VIEWS: Record<string, AuthView> = { inscription: "register", oubli: "forgot", nouveau: "reset" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: Search }) {
  const locale = await getLocale();
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const retour = safeReturnPath(one("retour"), locale);

  const session = await auth();
  if (session?.user?.id && one("vue") !== "nouveau") redirect(retour);

  // « error » : renvoyé par Auth.js quand la connexion Google échoue.
  const notice = one("verifie") ? "verified" : one("erreur") === "lien" ? "badLink" : one("error") ? "google" : null;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12">
      <AuthPanel
        key={one("vue") ?? "signIn"}
        locale={locale}
        view={VIEWS[one("vue") ?? ""] ?? "signIn"}
        retour={retour}
        token={one("jeton") ?? ""}
        notice={notice}
        googleEnabled={!!process.env.AUTH_GOOGLE_ID}
      />
    </div>
  );
}
