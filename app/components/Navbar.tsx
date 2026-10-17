import { auth, signIn, signOut } from "@/auth";
import Link from "next/link";
import React from "react";
import { getDictionary } from "@/lib/i18n";
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
        <Link href="/" aria-label={t.home}>
          <Logo />
        </Link>
        <div className="flex items-center gap-2.5 sm:gap-6 text-[0.95rem]">
          <LanguageSwitcher locale={locale} label={t.language} />
          <Link href="/manifestations" className={linkClass}>
            {t.map}
          </Link>
          {session && session.user ? (
            <>
              <Link href="/startup/create" className={linkClass}>
                {t.create}
              </Link>
              <Link href={`/user/${session.user.id}`} className={`${linkClass} hidden sm:inline`}>
                {session.user.name}
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
            <form
              action={async () => {
                "use server";
                await signIn("github");
              }}
            >
              <button type="submit" className={buttonClass}>
                {t.signIn}
              </button>
            </form>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
