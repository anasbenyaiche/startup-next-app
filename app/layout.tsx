import type { Metadata } from "next";
import { Bricolage_Grotesque, Noto_Sans_Arabic } from "next/font/google";
import { dir, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
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
  return { title: "Cortège", description: t.meta.description };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dir(locale)}>
      <body className={`${bricolage.variable} ${arabic.variable} antialiased`}>{children}</body>
    </html>
  );
}
