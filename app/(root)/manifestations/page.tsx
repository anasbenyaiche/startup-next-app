import type { Metadata } from "next";
import { auth } from "@/auth";
import ManifestationsMap from "@/app/components/ManifestationsMap";
import { isoToFips } from "@/lib/countries";
import { getDictionary, localePath } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/locale";
import { pageMetadata } from "@/lib/seo";
import { getProfile } from "@/lib/profile";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale).seo;
  return pageMetadata({
    locale,
    path: (l) => localePath(l, "/manifestations"),
    title: `${t.mapTitle} | Cortège`,
    description: t.mapDescription,
    ogTitle: t.mapTitle,
  });
}

export default async function ManifestationsPage() {
  const [locale, visitorIso, session] = await Promise.all([getLocale(), getVisitorCountry(), auth()]);
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  return (
    <ManifestationsMap
      locale={locale}
      defaultCountry={visitorIso ? isoToFips(visitorIso) : null}
      profile={profile}
    />
  );
}
