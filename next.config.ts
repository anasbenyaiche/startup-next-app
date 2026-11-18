import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Textes éditoriaux (content/*.md) lus au moment de la requête : à embarquer
  // avec les fonctions serveur.
  outputFileTracingIncludes: { "/**": ["./content/**/*.md"] },
  images: {
    // Photos de profil Google, affichées sur la page profil.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
