import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos de profil Google, affichées sur la page profil.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
