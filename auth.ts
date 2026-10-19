import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  burnPasswordCheck,
  createToken,
  findOrCreateGoogleAccount,
  getAccountByEmail,
  getAccountById,
  normalizeEmail,
  resetLimit,
  underLimit,
  verifyPassword,
} from "@/lib/accounts";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { sendAccountMail } from "@/lib/mail";
import { siteOrigin } from "@/lib/site";

// Connexion par Google (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, lus automatiquement)
// ou par e-mail et mot de passe. Les deux mènent au compte de l'adresse e-mail
// (lib/accounts.ts), dont l'identifiant sert de clé au profil.

// Codes renvoyés au formulaire. Ils restent vagues : « invalid » ne dit pas si
// c'est l'adresse ou le mot de passe qui est faux.
class UnverifiedEmail extends CredentialsSignin {
  code = "unverified";
}
class TooManyAttempts extends CredentialsSignin {
  code = "too_many";
}

const FAILURE_WINDOW = 15 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: { signIn: "/connexion", error: "/connexion" },
  // Un mauvais mot de passe est un cas normal, pas une erreur à journaliser.
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: {}, locale: {} },
      async authorize(credentials, request) {
        const email = normalizeEmail(credentials.email);
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        const allowed =
          (await underLimit(`login:email:${email}`, 10, FAILURE_WINDOW)) &&
          (await underLimit(`login:ip:${ip}`, 30, FAILURE_WINDOW));
        if (!allowed) throw new TooManyAttempts();

        const account = await getAccountByEmail(email);
        if (!account?.passwordHash) {
          await burnPasswordCheck(password);
          return null;
        }
        if (!(await verifyPassword(password, account.passwordHash))) return null;

        if (!account.verifiedAt) {
          // Renvoie le lien, au plus 3 fois par heure pour ne pas servir à inonder une boîte.
          if (await underLimit(`mail:${email}`, 3, 3600)) {
            const raw = String(credentials.locale);
            const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
            const token = await createToken("verify", email);
            await sendAccountMail("verify", email, `${await siteOrigin()}/api/compte/verifier?jeton=${token}&lang=${locale}`, locale);
          }
          throw new UnverifiedEmail();
        }

        await resetLimit(`login:email:${email}`);
        return { id: account.id, email: account.email };
      },
    }),
  ],
  callbacks: {
    // Google doit avoir vérifié l'adresse, sinon n'importe qui pourrait se
    // rattacher au compte d'une adresse qui n'est pas la sienne.
    signIn({ account, profile }) {
      if (account?.provider === "google") return profile?.email_verified === true && !!normalizeEmail(profile.email);
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const acc = await findOrCreateGoogleAccount(normalizeEmail(profile.email)!);
        token.uid = acc.id;
        token.email = acc.email;
      } else if (account?.provider === "credentials" && user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    // Sans identifiant de compte (ancienne session GitHub), la session ne donne accès à rien.
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      else session.user.id = "";
      return session;
    },
  },
});

// Compte de la session en cours, relu dans la base : un compte supprimé
// n'ouvre plus rien, même si son cookie est encore valable.
export async function currentAccount() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? getAccountById(id) : null;
}
