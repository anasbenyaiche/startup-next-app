import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos de profil GitHub, affichées sur la page profil.
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
};

export default nextConfig;
