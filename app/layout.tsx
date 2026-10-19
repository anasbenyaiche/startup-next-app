import type { Metadata } from "next";
import { Bricolage_Grotesque, Noto_Sans_Arabic } from "next/font/google";
import { dir, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { SITE_URL } from "@/lib/seo";
import CookieNotice from "./components/CookieNotice";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
});

// Bricolage n'a pas de glyphes arabes ; le navigateur ne télécharge cette police
// que si la page contient de l'arabe.
const arabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: "Cortège",
    title: { default: "Cortège", template: "%s | Cortège" },
    description: t.meta.description,
    formatDetection: { telephone: false },
    // Relie le site au compte AdSense (vérification de propriété demandée par Google).
    other: { "google-adsense-account": "ca-pub-4562660686818427" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dir(locale)}>
      <body className={`${bricolage.variable} ${arabic.variable} antialiased`}>
        {children}
        <CookieNotice locale={locale} />
      </body>
    </html>
  );
}
