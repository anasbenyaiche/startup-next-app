import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        papier: "var(--papier)",
        "papier-fonce": "var(--papier-fonce)",
        encre: "var(--encre)",
        gris: "var(--gris)",
        rose: "var(--rose)",
        bleu: "var(--bleu)",
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
