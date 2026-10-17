import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// Connexion par GitHub. Les identifiants viennent de AUTH_GITHUB_ID et
// AUTH_GITHUB_SECRET (lus automatiquement par next-auth).
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    // Sans base de données, la session est un jeton signé : on y garde
    // l'identifiant GitHub, stable, qui sert de clé au profil.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
