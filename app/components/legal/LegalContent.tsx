import type { ReactNode } from "react";
import { HOST, type LegalInfo, type LegalPage } from "@/lib/legal";

// Textes des pages légales, en français et en anglais. Ils décrivent ce que le
// code fait réellement (cookies, données gardées, services tiers) : à mettre à
// jour si l'un de ces points change.

export type LegalLang = "fr" | "en";

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 text-xl font-bold">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-encre/90">{children}</p>;
}
function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 ps-6 leading-relaxed text-encre/90">{children}</ul>;
}
function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-bleu underline underline-offset-4" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
// Valeur légale, en évidence si elle n'est pas encore renseignée.
function V({ v }: { v: { text: string; missing: boolean } }) {
  return v.missing ? <mark className="bg-rose/30 px-1">{v.text}</mark> : <>{v.text}</>;
}

type Cookie = { name: string; purpose: Record<LegalLang, string>; duration: Record<LegalLang, string> };

const COOKIES: Cookie[] = [
  {
    name: "lang",
    purpose: { fr: "Garde la langue que vous avez choisie.", en: "Remembers the language you chose." },
    duration: { fr: "1 an", en: "1 year" },
  },
  {
    name: "authjs.session-token",
    purpose: {
      fr: "Garde votre connexion (seulement si vous vous connectez). Contenu chiffré : identifiant, nom, adresse e-mail et photo de votre compte GitHub.",
      en: "Keeps you signed in (only if you sign in). Encrypted content: your GitHub account's ID, name, email address and picture.",
    },
    duration: { fr: "30 jours", en: "30 days" },
  },
  {
    name: "authjs.csrf-token",
    purpose: {
      fr: "Protège la connexion contre les requêtes falsifiées.",
      en: "Protects sign-in against forged requests.",
    },
    duration: { fr: "Session de navigation", en: "Browser session" },
  },
  {
    name: "authjs.callback-url",
    purpose: { fr: "Page où revenir après la connexion.", en: "Page to return to after signing in." },
    duration: { fr: "Session de navigation", en: "Browser session" },
  },
];

function CookieTable({ lang }: { lang: LegalLang }) {
  const head = lang === "fr" ? ["Nom", "Rôle", "Durée"] : ["Name", "Purpose", "Duration"];
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-[1.5px] border-encre text-start">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pe-4 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COOKIES.map((c) => (
            <tr key={c.name} className="border-b border-encre/15 align-top">
              <td className="py-2 pe-4 font-mono text-xs whitespace-nowrap">{c.name}</td>
              <td className="py-2 pe-4">{c.purpose[lang]}</td>
              <td className="py-2 whitespace-nowrap">{c.duration[lang]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const LEGAL_TITLES: Record<LegalPage, Record<LegalLang, string>> = {
  mentions: { fr: "Mentions légales", en: "Legal notice" },
  confidentialite: { fr: "Politique de confidentialité", en: "Privacy policy" },
  cookies: { fr: "Politique de cookies", en: "Cookie policy" },
};

export function LegalContent({ page, lang, info }: { page: LegalPage; lang: LegalLang; info: LegalInfo }) {
  const email = <V v={info.email} />;

  if (page === "mentions") {
    return lang === "fr" ? (
      <>
        <H2>Éditeur du site</H2>
        <P>
          <V v={info.publisher} />
          <br />
          <V v={info.status} />
          <br />
          <V v={info.address} />
          <br />
          Contact : {email}
        </P>
        <H2>Directeur de la publication</H2>
        <P>
          <V v={info.director} />
        </P>
        <H2>Hébergeur</H2>
        <P>
          {HOST.name}, {HOST.address}. <A href={HOST.url}>{HOST.url}</A>
        </P>
        <H2>Sources des données</H2>
        <P>
          Les manifestations affichées proviennent du <A href="https://www.gdeltproject.org/">GDELT Project</A>, qui
          analyse automatiquement les articles de presse du monde entier. Les fonds de carte sont fournis par{" "}
          <A href="https://www.openstreetmap.org/copyright">© les contributeurs d’OpenStreetMap</A> et{" "}
          <A href="https://carto.com/attributions">© CARTO</A>. Les titres et résumés d’articles appartiennent à leurs
          éditeurs ; chaque article renvoie vers sa source.
        </P>
        <H2>Responsabilité</H2>
        <P>
          Les informations sont extraites automatiquement de la presse et peuvent contenir des erreurs (lieu, date, type
          d’action, nombre de manifestations estimé). Elles ne constituent pas une information officielle. Pour signaler
          une erreur ou un contenu à retirer, écrivez à {email}.
        </P>
        <H2>Propriété intellectuelle</H2>
        <P>
          Le nom, le logo et la présentation du site sont la propriété de l’éditeur. Toute reproduction sans autorisation
          est interdite, sauf citation courte avec lien vers le site.
        </P>
      </>
    ) : (
      <>
        <H2>Publisher</H2>
        <P>
          <V v={info.publisher} />
          <br />
          <V v={info.status} />
          <br />
          <V v={info.address} />
          <br />
          Contact: {email}
        </P>
        <H2>Publication director</H2>
        <P>
          <V v={info.director} />
        </P>
        <H2>Hosting</H2>
        <P>
          {HOST.name}, 440 N Barranca Ave #4133, Covina, CA 91723, USA. <A href={HOST.url}>{HOST.url}</A>
        </P>
        <H2>Data sources</H2>
        <P>
          Protests come from the <A href="https://www.gdeltproject.org/">GDELT Project</A>, which automatically reads news
          articles worldwide. Base maps are provided by{" "}
          <A href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</A> and{" "}
          <A href="https://carto.com/attributions">© CARTO</A>. Article titles and summaries belong to their publishers;
          every article links to its source.
        </P>
        <H2>Liability</H2>
        <P>
          Information is extracted automatically from the press and may contain errors (place, date, type of action,
          estimated number of protests). It is not official information. To report an error or content to remove, write to{" "}
          {email}.
        </P>
        <H2>Intellectual property</H2>
        <P>
          The site’s name, logo and design belong to the publisher. Reproduction without permission is forbidden, except
          short quotes with a link to the site.
        </P>
      </>
    );
  }

  if (page === "confidentialite") {
    return lang === "fr" ? (
      <>
        <P>
          Cortège collecte le moins de données possible. Rien n’est vendu ni partagé à des fins commerciales, et ce que
          vous suivez ne sert jamais à la publicité.
        </P>
        <H2>Responsable du traitement</H2>
        <P>
          <V v={info.publisher} />, <V v={info.address} />. Contact : {email}
        </P>
        <H2>Si vous visitez le site sans compte</H2>
        <Ul>
          <li>
            Aucune donnée n’est enregistrée sur vous par Cortège. L’hébergeur garde des journaux techniques (adresse IP,
            page demandée, navigateur) pour la sécurité et le bon fonctionnement du service.
          </li>
          <li>
            Votre pays, déduit de votre adresse IP par l’hébergeur, sert seulement à choisir la langue et le pays affiché
            sur la carte. Il n’est pas conservé.
          </li>
          <li>
            Les aperçus d’articles sont lus par nos serveurs, pas par votre navigateur : les médias ne reçoivent aucune
            information sur vous.
          </li>
        </Ul>
        <H2>Si vous vous connectez (compte GitHub)</H2>
        <Ul>
          <li>
            GitHub nous transmet l’identifiant, le nom, l’adresse e-mail et la photo de votre compte. Ils restent dans un
            cookie chiffré sur votre appareil ; seul l’identifiant est utilisé pour retrouver votre profil.
          </li>
          <li>
            Votre profil contient les pays et lieux que vous suivez et vos réglages de carte. Il est privé : personne
            d’autre ne le voit.
          </li>
          <li>
            Suivre des manifestations peut révéler des opinions politiques, une catégorie de données protégée (article 9
            du RGPD). Ces suivis ne sont enregistrés qu’avec votre consentement explicite, demandé au premier suivi. Vous
            pouvez le retirer à tout moment en supprimant vos données. Les réglages de carte reposent sur l’exécution du
            service que vous demandez (article 6.1.b).
          </li>
        </Ul>
        <H2>Publicité</H2>
        <Ul>
          <li>
            Les annonces directes sont choisies selon le pays affiché sur la carte, jamais selon vous. Nous comptons
            seulement le nombre total d’affichages et de clics par annonce et par mois.
          </li>
          <li>
            Si des annonces Google AdSense sont affichées, Google agit comme responsable de traitement indépendant et vous
            demande votre consentement par son propre message. Voir{" "}
            <A href="https://policies.google.com/technologies/ads">les règles de Google</A>.
          </li>
        </Ul>
        <H2>Services tiers chargés par votre navigateur</H2>
        <P>
          La carte charge la bibliothèque Leaflet depuis unpkg.com et les fonds de carte depuis CARTO (données
          OpenStreetMap). Comme pour toute page web, ces services reçoivent votre adresse IP et des informations sur votre
          navigateur.
        </P>
        <H2>Destinataires et sous-traitants</H2>
        <Ul>
          <li>Vercel Inc. (hébergement, États-Unis), dans le cadre du Data Privacy Framework UE–États-Unis.</li>
          <li>Le fournisseur de la base Redis qui stocke les profils.</li>
          <li>GitHub (authentification), si vous vous connectez.</li>
        </Ul>
        <H2>Durées de conservation</H2>
        <Ul>
          <li>Profil : jusqu’à ce que vous le supprimiez.</li>
          <li>Cookie de connexion : 30 jours, ou jusqu’à la déconnexion.</li>
          <li>Statistiques publicitaires : totaux mensuels, sans donnée personnelle.</li>
          <li>Journaux techniques : selon la durée de conservation de l’hébergeur.</li>
        </Ul>
        <H2>Vos droits</H2>
        <P>
          Vous disposez des droits d’accès, de rectification, d’effacement, de portabilité, de limitation et
          d’opposition, et du droit de retirer votre consentement. Depuis votre profil, vous pouvez télécharger vos
          données et les supprimer en un clic. Pour toute autre demande : {email}. Vous pouvez aussi adresser une
          réclamation à la <A href="https://www.cnil.fr/fr/plaintes">CNIL</A>.
        </P>
      </>
    ) : (
      <>
        <P>
          Cortège collects as little data as possible. Nothing is sold or shared for commercial purposes, and what you
          follow is never used for advertising.
        </P>
        <H2>Data controller</H2>
        <P>
          <V v={info.publisher} />, <V v={info.address} />. Contact: {email}
        </P>
        <H2>If you visit without an account</H2>
        <Ul>
          <li>
            Cortège records nothing about you. The host keeps technical logs (IP address, requested page, browser) for
            security and to run the service.
          </li>
          <li>
            Your country, derived from your IP address by the host, is only used to pick the language and the country
            shown on the map. It is not stored.
          </li>
          <li>Article previews are read by our servers, not your browser: news outlets receive nothing about you.</li>
        </Ul>
        <H2>If you sign in (GitHub account)</H2>
        <Ul>
          <li>
            GitHub sends us your account’s ID, name, email address and picture. They stay in an encrypted cookie on your
            device; only the ID is used to find your profile.
          </li>
          <li>Your profile holds the countries and places you follow and your map settings. It is private.</li>
          <li>
            Following protests can reveal political opinions, a protected category of data (GDPR article 9). Follows are
            only stored with your explicit consent, asked on your first follow. You can withdraw it at any time by
            deleting your data. Map settings rely on providing the service you ask for (article 6.1.b).
          </li>
        </Ul>
        <H2>Advertising</H2>
        <Ul>
          <li>
            Direct ads are chosen by the country shown on the map, never by who you are. We only count total views and
            clicks per ad and per month.
          </li>
          <li>
            If Google AdSense ads are shown, Google acts as an independent controller and asks for your consent through its
            own message. See <A href="https://policies.google.com/technologies/ads">Google’s policies</A>.
          </li>
        </Ul>
        <H2>Third-party services loaded by your browser</H2>
        <P>
          The map loads the Leaflet library from unpkg.com and base maps from CARTO (OpenStreetMap data). As with any web
          page, these services receive your IP address and browser information.
        </P>
        <H2>Recipients and processors</H2>
        <Ul>
          <li>Vercel Inc. (hosting, USA), under the EU–US Data Privacy Framework.</li>
          <li>The provider of the Redis database that stores profiles.</li>
          <li>GitHub (authentication), if you sign in.</li>
        </Ul>
        <H2>Retention</H2>
        <Ul>
          <li>Profile: until you delete it.</li>
          <li>Sign-in cookie: 30 days, or until you sign out.</li>
          <li>Advertising statistics: monthly totals, with no personal data.</li>
          <li>Technical logs: according to the host’s retention period.</li>
        </Ul>
        <H2>Your rights</H2>
        <P>
          You have the rights of access, rectification, erasure, portability, restriction and objection, and the right to
          withdraw consent. From your profile you can download and delete your data in one click. For anything else:{" "}
          {email}. You can also complain to your data protection authority (in France, the{" "}
          <A href="https://www.cnil.fr/en/complaints">CNIL</A>).
        </P>
      </>
    );
  }

  return lang === "fr" ? (
    <>
      <P>
        Un cookie est un petit fichier déposé sur votre appareil. Cortège n’utilise que des cookies nécessaires à son
        fonctionnement : ils sont dispensés de consentement (article 82 de la loi Informatique et Libertés). Aucun cookie de
        mesure d’audience ni de publicité n’est déposé par Cortège.
      </P>
      <H2>Cookies utilisés</H2>
      <CookieTable lang="fr" />
      <P>
        Sur une connexion sécurisée, les cookies de connexion portent le préfixe <code>__Secure-</code> ou{" "}
        <code>__Host-</code>. Votre navigateur garde aussi, sans cookie, le fait que vous avez fermé le bandeau
        d’information (stockage local, clé <code>cortege-cookie-notice</code>).
      </P>
      <H2>Publicité</H2>
      <P>
        Les annonces directes ne déposent aucun cookie. Si des annonces Google AdSense sont affichées, Google peut déposer
        ses propres cookies : il vous demande alors votre consentement par son message, et vous pouvez le modifier à tout
        moment depuis celui-ci.
      </P>
      <H2>Services tiers</H2>
      <P>
        La bibliothèque de carte (unpkg.com) et les fonds de carte (CARTO, OpenStreetMap) sont chargés par votre
        navigateur. À notre connaissance, ils ne déposent pas de cookie, mais reçoivent votre adresse IP.
      </P>
      <H2>Gérer les cookies</H2>
      <P>
        Vous pouvez supprimer ou bloquer les cookies dans les réglages de votre navigateur. Le site restera utilisable : vous
        perdrez seulement le choix de la langue et votre connexion.
      </P>
    </>
  ) : (
    <>
      <P>
        A cookie is a small file stored on your device. Cortège only uses cookies needed for the site to work: they do not
        require consent. Cortège sets no analytics or advertising cookies.
      </P>
      <H2>Cookies we use</H2>
      <CookieTable lang="en" />
      <P>
        Over a secure connection, sign-in cookies carry the <code>__Secure-</code> or <code>__Host-</code> prefix. Your
        browser also remembers, without a cookie, that you closed the information banner (local storage, key{" "}
        <code>cortege-cookie-notice</code>).
      </P>
      <H2>Advertising</H2>
      <P>
        Direct ads set no cookies. If Google AdSense ads are shown, Google may set its own cookies: it then asks for your
        consent through its own message, where you can change your choice at any time.
      </P>
      <H2>Third-party services</H2>
      <P>
        The map library (unpkg.com) and base maps (CARTO, OpenStreetMap) are loaded by your browser. To our knowledge they
        set no cookies, but they receive your IP address.
      </P>
      <H2>Managing cookies</H2>
      <P>
        You can delete or block cookies in your browser settings. The site stays usable: you only lose your language choice
        and your sign-in.
      </P>
    </>
  );
}
