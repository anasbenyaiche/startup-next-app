import type { Metadata } from "next";
import ManifestationsMap from "@/app/components/ManifestationsMap";
import { isoToFips } from "@/lib/countries";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${getDictionary(await getLocale()).meta.mapTitle}, Cortège` };
}

export default async function ManifestationsPage() {
  const locale = await getLocale();
  const visitorIso = await getVisitorCountry();
  return <ManifestationsMap locale={locale} defaultCountry={visitorIso ? isoToFips(visitorIso) : null} />;
}
