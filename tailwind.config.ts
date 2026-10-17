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
        papier: "rgb(var(--papier) / <alpha-value>)",
        "papier-fonce": "rgb(var(--papier-fonce) / <alpha-value>)",
        encre: "rgb(var(--encre) / <alpha-value>)",
        gris: "rgb(var(--gris) / <alpha-value>)",
        rose: "rgb(var(--rose) / <alpha-value>)",
        bleu: "rgb(var(--bleu) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "var(--font-arabic)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
