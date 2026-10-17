import { auth, signIn, signOut } from "@/auth";
import Link from "next/link";
import React from "react";
import Logo from "./Logo";

const linkClass = "hover:text-bleu underline-offset-4 hover:underline";
const buttonClass =
  "rounded-[3px] border-[1.5px] border-encre px-3 py-1 font-semibold hover:bg-encre hover:text-papier transition-colors";

const Navbar = async () => {
  const session = await auth();
  return (
    <header className="h-14 px-4 sm:px-6 bg-papier border-b-[1.5px] border-encre">
      <nav className="h-full flex justify-between items-center gap-4">
        <Link href="/" aria-label="Cortège, accueil">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-[0.95rem]">
          <Link href="/manifestations" className={linkClass}>
            Carte
          </Link>
          {session && session.user ? (
            <>
              <Link href="/startup/create" className={linkClass}>
                Créer
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
                  Se déconnecter
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
                Se connecter
              </button>
            </form>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
