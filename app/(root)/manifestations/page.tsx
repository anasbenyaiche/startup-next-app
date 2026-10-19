import type { Metadata } from "next";
import { auth, currentAccount } from "@/auth";
import ManifestationsMap from "@/app/components/ManifestationsMap";
import { isoToFips } from "@/lib/geo/countries";
import { getDictionary, localePath } from "@/lib/i18n";
import { getLocale, getVisitorCountry } from "@/lib/i18n/request";
import { pageMetadata } from "@/lib/news/seo";
import { getProfile } from "@/lib/users/profile";
import { isModerator } from "@/lib/users/admin";

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
  const [locale, visitorIso, session, account, admin] = await Promise.all([
    getLocale(),
    getVisitorCountry(),
    auth(),
    currentAccount(),
    isModerator(),
  ]);
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  return (
    <ManifestationsMap
      locale={locale}
      defaultCountry={visitorIso ? isoToFips(visitorIso) : null}
      profile={profile}
      // Alertes SOS : réservées aux comptes vérifiés ; exemples réservés aux modérateurs.
      sos={{ canSend: !!account?.verifiedAt, admin, visitorIso }}
    />
  );
}
