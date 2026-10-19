import { auth, signOut } from "@/auth";
import Link from "next/link";
import React from "react";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/features";
import { getDictionary, localePath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";

const linkClass = "whitespace-nowrap hover:text-bleu underline-offset-4 hover:underline";
const buttonClass =
  "whitespace-nowrap rounded-[3px] border-[1.5px] border-encre px-2 sm:px-3 py-1 text-sm sm:text-base font-semibold hover:bg-encre hover:text-papier transition-colors";

const Navbar = async () => {
  const session = await auth();
  const locale = await getLocale();
  const t = getDictionary(locale).nav;
  return (
    <header className="h-14 px-3 sm:px-6 bg-papier border-b-[1.5px] border-encre">
      <nav className="h-full flex justify-between items-center gap-4">
        <Link href={localePath(locale, "/")} aria-label={t.home}>
          <Logo />
        </Link>
        <div className="flex items-center gap-2.5 sm:gap-6 text-[0.95rem]">
          <LanguageSwitcher locale={locale} label={t.language} />
          <Link href={localePath(locale, "/manifestations")} className={linkClass}>
            {t.map}
          </Link>
          <Link href={localePath(locale, "/couvre-feu")} className={`${linkClass} hidden sm:inline`}>
            {getDictionary(locale).curfew.nav}
          </Link>
          {session?.user?.id ? (
            <>
              {ANNOUNCEMENTS_ENABLED && (
                <Link href={localePath(locale, "/startup/create")} className={`${linkClass} hidden sm:inline`}>
                  {t.create}
                </Link>
              )}
              <Link href={localePath(locale, "/profil")} className={linkClass}>
                {getDictionary(locale).nav2.profile}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button type="submit" className={buttonClass}>
                  {t.signOut}
                </button>
              </form>
            </>
          ) : (
            <Link href={localePath(locale, "/connexion")} className={buttonClass}>
              {t.signIn}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
