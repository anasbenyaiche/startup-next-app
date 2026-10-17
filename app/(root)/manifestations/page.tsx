import type { Metadata } from "next";
import { auth } from "@/auth";
import ManifestationsMap from "@/app/components/ManifestationsMap";
import { isoToFips } from "@/lib/countries";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/locale";
import { getProfile } from "@/lib/profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${getDictionary(await getLocale()).meta.mapTitle}, Cortège` };
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
