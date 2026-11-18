import Link from "next/link";
import type { ReactNode } from "react";
import { INDEX_MIN_INCIDENTS, type InfoPage } from "@/lib/content/pages";
import type { LegalInfo } from "@/lib/content/legal";
import { COUNTRY_SEGMENT, localePath, type Locale } from "@/lib/i18n";

// Textes des pages À propos, Méthodologie et Contact, en français et en anglais.
// La méthodologie décrit ce que fait le code (lib/news/gdelt.ts, manifestations.ts) :
// à mettre à jour si le calcul change.

export type InfoLang = "fr" | "en";

export const INFO_TITLES: Record<InfoPage, Record<InfoLang, string>> = {
  "a-propos": { fr: "À propos de Cortège", en: "About Cortège" },
  methodologie: { fr: "Méthodologie", en: "Methodology" },
  contact: { fr: "Contact", en: "Contact" },
};

export const INFO_DESCRIPTIONS: Record<InfoPage, Record<InfoLang, string>> = {
  "a-propos": {
    fr: "Pourquoi Cortège existe, ce que le site fait et ne fait pas, qui l’édite et comment il est financé.",
    en: "Why Cortège exists, what the site does and does not do, who publishes it and how it is funded.",
  },
  methodologie: {
    fr: "D’où viennent les données de Cortège (GDELT), comment les manifestations sont regroupées, comment se calcule le score de fiabilité, et les limites.",
    en: "Where Cortège’s data comes from (GDELT), how protests are grouped, how the reliability score is computed, and the limits.",
  },
  contact: {
    fr: "Écrire à l’équipe de Cortège : corrections, suppression de données, presse et partenariats.",
    en: "Write to the Cortège team: corrections, data removal, press and partnerships.",
  },
};

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
function In({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-bleu underline underline-offset-4">
      {children}
    </Link>
  );
}
// Valeur lue dans l’environnement, en évidence si elle n’est pas encore renseignée.
function V({ v }: { v: { text: string; missing: boolean } }) {
  return v.missing ? <mark className="bg-rose/30 px-1">{v.text}</mark> : <>{v.text}</>;
}
function Mail({ v }: { v: { text: string; missing: boolean } }) {
  return v.missing ? (
    <V v={v} />
  ) : (
    <a href={`mailto:${v.text}`} className="text-bleu underline underline-offset-4">
      {v.text}
    </a>
  );
}

type Props = { page: InfoPage; lang: InfoLang; locale: Locale; info: LegalInfo };

export function AboutContent(props: Props) {
  const Page = { "a-propos": About, methodologie: Methodology, contact: Contact }[props.page];
  return <Page {...props} />;
}

function About({ lang, locale, info }: Props) {
  const p = (path: string) => localePath(locale, path);
  if (lang === "fr")
    return (
      <>
        <P>
          Cortège montre, sur une carte et pays par pays, les manifestations, grèves, blocages et émeutes que la presse
          du monde entier signale en ce moment. La carte est mise à jour toutes les 15 minutes.
        </P>
        <H2>Pourquoi ce site</H2>
        <P>
          Quand une mobilisation commence, l’information est éparpillée entre des dizaines de médias, dans des dizaines
          de langues. Cortège rassemble ces signaux en un seul endroit pour répondre vite à des questions simples : où
          manifeste-t-on aujourd’hui ? Est-ce que ça se passe près de chez moi ? Combien de médias en parlent ?
        </P>
        <P>
          Le site sert aussi l’entraide : les personnes présentes peuvent signaler ce qu’elles voient, et les comptes
          vérifiés peuvent lancer une alerte SOS (feu, blessé, pillage) visible 15 minutes sur la carte, avec le numéro
          d’urgence du pays.
        </P>
        <H2>Ce que fait Cortège, et ce qu’il ne fait pas</H2>
        <Ul>
          <li>Il agrège et localise des articles de presse : il ne produit pas de reportage.</li>
          <li>
            Il donne pour chaque lieu un score de fiabilité et la liste des médias sources, pour que chacun puisse
            vérifier.
          </li>
          <li>
            Il ne prend parti pour aucune cause : toutes les mobilisations signalées par la presse sont traitées de la
            même façon.
          </li>
          <li>Il ne remplace pas les autorités : en cas d’urgence, appelez toujours les secours.</li>
        </Ul>
        <P>
          Le détail des sources et des calculs est sur la page <In href={p("/methodologie")}>Méthodologie</In>.
        </P>
        <H2>Qui édite le site</H2>
        <P>
          Cortège est un projet indépendant édité par <V v={info.publisher} />. Les informations complètes sont dans les{" "}
          <In href={p("/legal/mentions")}>mentions légales</In>.
        </P>
        <H2>Financement</H2>
        <P>
          Le site est gratuit et sans abonnement. Il peut afficher des emplacements publicitaires, toujours séparés du
          contenu et signalés comme tels. Les annonceurs n’ont aucune influence sur ce qui est affiché sur la carte.
        </P>
        <H2>Vos données</H2>
        <P>
          Consulter la carte ne demande aucun compte. Un compte sert seulement à suivre des pays ou des lieux, et à
          publier un signalement ou une alerte : votre identité n’est jamais publiée avec. Voir la page{" "}
          <In href={p("/legal/confidentialite")}>Confidentialité</In>.
        </P>
        <P>
          Une question, une erreur à corriger ? <In href={p("/contact")}>Écrivez-nous</In>.
        </P>
      </>
    );
  return (
    <>
      <P>
        Cortège shows, on a map and country by country, the protests, strikes, blockades and riots that the press around
        the world is reporting right now. The map is updated every 15 minutes.
      </P>
      <H2>Why this site</H2>
      <P>
        When a movement starts, information is scattered across dozens of outlets in dozens of languages. Cortège brings
        these signals together in one place to quickly answer simple questions: where are people protesting today? Is it
        happening near me? How many outlets are covering it?
      </P>
      <P>
        The site also supports mutual aid: people on the ground can report what they see, and verified accounts can send
        an SOS alert (fire, injury, looting) shown on the map for 15 minutes, with the country’s emergency number.
      </P>
      <H2>What Cortège does, and does not do</H2>
      <Ul>
        <li>It aggregates and locates press articles: it does not produce reporting of its own.</li>
        <li>It gives each place a reliability score and the list of source outlets, so anyone can check.</li>
        <li>It takes no side: every movement reported by the press is treated the same way.</li>
        <li>It does not replace the authorities: in an emergency, always call the emergency services.</li>
      </Ul>
      <P>
        Sources and calculations are detailed on the <In href={p("/methodologie")}>Methodology</In> page.
      </P>
      <H2>Who publishes the site</H2>
      <P>
        Cortège is an independent project published by <V v={info.publisher} />. Full details are in the{" "}
        <In href={p("/legal/mentions")}>legal notice</In>.
      </P>
      <H2>Funding</H2>
      <P>
        The site is free, with no subscription. It may show ad slots, always kept apart from the content and labelled as
        such. Advertisers have no say in what the map shows.
      </P>
      <H2>Your data</H2>
      <P>
        Browsing the map needs no account. An account is only used to follow countries or places, and to post a report
        or an alert: your identity is never published with it. See the{" "}
        <In href={p("/legal/confidentialite")}>Privacy</In> page.
      </P>
      <P>
        A question, an error to fix? <In href={p("/contact")}>Write to us</In>.
      </P>
    </>
  );
}

function Methodology({ lang, locale }: Props) {
  const p = (path: string) => localePath(locale, path);
  const gdelt = <A href="https://www.gdeltproject.org/">GDELT Project</A>;
  if (lang === "fr")
    return (
      <>
        <P>
          Cette page explique d’où viennent les chiffres de Cortège, comment ils sont calculés et où sont leurs limites.
        </P>
        <H2>1. La source : GDELT</H2>
        <P>
          Les données viennent du {gdelt}, une base ouverte qui lit en continu la presse en ligne du monde entier, dans
          des dizaines de langues, et en extrait des événements : qui a fait quoi, où et quand. GDELT publie un nouveau
          fichier toutes les 15 minutes. Cortège lit chacun de ces fichiers.
        </P>
        <H2>2. Ce qui est retenu</H2>
        <Ul>
          <li>
            Seuls les événements de la famille « protestation » de la classification CAMEO (codes 14x) : manifestations,
            grèves et boycotts, blocages, occupations, émeutes.
          </li>
          <li>
            Seuls les événements situés au moins à l’échelle d’une région ou d’une ville. Un événement placé seulement
            au niveau d’un pays entier est écarté : on ne saurait pas où le mettre sur la carte.
          </li>
          <li>
            Un événement daté de plus de 3 jours avant sa détection est écarté : c’est en général un rappel
            (anniversaire, procès), pas une mobilisation en cours.
          </li>
        </Ul>
        <H2>3. Regroupement par lieu et par manifestation</H2>
        <P>
          Les événements sont regroupés par lieu, à partir de l’identifiant géographique de GDELT (ville ou région),
          plutôt que par un simple arrondi des coordonnées.
        </P>
        <P>
          Un même rassemblement produit souvent plusieurs événements dans GDELT : un par article, et un par façon de
          nommer les acteurs. Cortège compte donc comme une seule manifestation l’ensemble des événements d’un même
          type, au même endroit, le même jour. Les chiffres affichés sont des estimations prudentes, pas un décompte
          officiel.
        </P>
        <H2>4. Le score de fiabilité</H2>
        <P>Chaque lieu reçoit un score de 0 à 100, à partir de trois signaux indépendants :</P>
        <Ul>
          <li>
            <strong>La diversité des médias (45 %)</strong> : le nombre de sites d’information distincts qui en parlent.
            C’est le signal le plus fort : un fait repris par cinq médias différents est rarement inventé.
          </li>
          <li>
            <strong>La confiance de l’extraction (35 %)</strong> : GDELT note, pour chaque article, sa confiance dans
            l’événement qu’il en a tiré.
          </li>
          <li>
            <strong>La place dans l’article (20 %)</strong> : la part d’événements tirés du début des articles, là où se
            trouve l’information principale.
          </li>
        </Ul>
        <P>
          Au-dessus de 70, la fiabilité est dite élevée ; de 45 à 69, moyenne ; en dessous, faible. La liste des médias
          et des articles est toujours affichée dans la fiche du lieu.
        </P>
        <H2>5. Signalements des témoins et alertes SOS</H2>
        <P>
          En plus de la presse, les personnes présentes peuvent publier un signalement (cortège, rassemblement, gaz
          lacrymogène, danger, route bloquée). Les autres utilisateurs connectés peuvent le confirmer, ce qui prolonge
          sa durée, ou le signaler comme abusif : au troisième signalement d’abus, il est retiré. Les alertes SOS sont
          réservées aux comptes dont l’adresse e-mail est vérifiée et s’effacent au bout de 15 minutes. Ces contenus
          sont publiés sans le nom ni l’adresse de leur auteur, et l’équipe de modération peut les retirer.
        </P>
        <H2>6. Les pages pays</H2>
        <P>
          Une page pays résume les dernières 24 heures. Elle n’est proposée aux moteurs de recherche que si au moins{" "}
          {INDEX_MIN_INCIDENTS} manifestations y ont été relevées : en dessous, l’information est trop mince pour
          mériter une page à part entière. Voir <In href={p(`/${COUNTRY_SEGMENT[locale]}`)}>tous les pays</In>.
        </P>
        <H2>7. Les limites</H2>
        <Ul>
          <li>
            La carte reflète ce que la presse en ligne couvre : les pays peu couverts ou les zones sous censure sont
            sous-représentés, les grandes villes sur-représentées.
          </li>
          <li>
            L’extraction automatique fait des erreurs : un article d’analyse ou un rappel historique peut être pris pour
            un événement du jour, ou une ville mal localisée. Le score de fiabilité sert à repérer ces cas.
          </li>
          <li>Le nombre de participants n’est pas connu : la taille d’un point reflète la couverture, pas la foule.</li>
          <li>
            Les données arrivent avec le délai de publication de la presse, en général de 15 minutes à quelques heures.
          </li>
        </Ul>
        <P>
          Une erreur sur la carte ? <In href={p("/contact")}>Signalez-la-nous</In>.
        </P>
      </>
    );
  return (
    <>
      <P>This page explains where Cortège’s figures come from, how they are computed, and where their limits lie.</P>
      <H2>1. The source: GDELT</H2>
      <P>
        The data comes from the {gdelt}, an open database that continuously reads online news from around the world, in
        dozens of languages, and extracts events from it: who did what, where and when. GDELT publishes a new file every
        15 minutes. Cortège reads each of these files.
      </P>
      <H2>2. What is kept</H2>
      <Ul>
        <li>
          Only events in the « protest » family of the CAMEO classification (codes 14x): demonstrations, strikes and
          boycotts, blockades, occupations, riots.
        </li>
        <li>
          Only events located at least at the level of a region or a city. An event placed only at the level of a whole
          country is dropped: there is no way to put it on the map.
        </li>
        <li>
          An event dated more than 3 days before it was detected is dropped: it is usually a reminder (anniversary,
          trial), not an ongoing movement.
        </li>
      </Ul>
      <H2>3. Grouping by place and by protest</H2>
      <P>
        Events are grouped by place, using GDELT’s geographic identifier (city or region) rather than simply rounding
        coordinates.
      </P>
      <P>
        A single gathering often produces several events in GDELT: one per article, and one per way of naming the
        actors. Cortège therefore counts all events of the same type, in the same place, on the same day as one protest.
        The figures shown are cautious estimates, not an official count.
      </P>
      <H2>4. The reliability score</H2>
      <P>Each place gets a score from 0 to 100, based on three independent signals:</P>
      <Ul>
        <li>
          <strong>Outlet diversity (45%)</strong>: the number of distinct news sites covering it. This is the strongest
          signal: a fact picked up by five different outlets is rarely made up.
        </li>
        <li>
          <strong>Extraction confidence (35%)</strong>: for each article, GDELT rates its confidence in the event it
          extracted.
        </li>
        <li>
          <strong>Position in the article (20%)</strong>: the share of events taken from the start of articles, where
          the main information is.
        </li>
      </Ul>
      <P>
        Above 70, reliability is high; from 45 to 69, medium; below, low. The list of outlets and articles is always
        shown in the place’s details.
      </P>
      <H2>5. Witness reports and SOS alerts</H2>
      <P>
        Besides the press, people on the ground can post a report (march, gathering, tear gas, danger, blocked road).
        Other signed-in users can confirm it, which extends its lifetime, or flag it as abusive: at the third abuse
        flag, it is removed. SOS alerts are limited to accounts with a verified email address and are deleted after 15
        minutes. This content is published without its author’s name or address, and the moderation team can remove it.
      </P>
      <H2>6. Country pages</H2>
      <P>
        A country page sums up the last 24 hours. It is offered to search engines only if at least {INDEX_MIN_INCIDENTS}{" "}
        protests were recorded there: below that, the information is too thin to deserve a page of its own. See{" "}
        <In href={p(`/${COUNTRY_SEGMENT[locale]}`)}>all countries</In>.
      </P>
      <H2>7. Limits</H2>
      <Ul>
        <li>
          The map reflects what online news covers: countries with little coverage or under censorship are
          under-represented, big cities over-represented.
        </li>
        <li>
          Automatic extraction makes mistakes: an analysis piece or a historical reminder can be taken for today’s
          event, or a city misplaced. The reliability score helps spot these cases.
        </li>
        <li>The number of participants is unknown: the size of a dot reflects coverage, not the crowd.</li>
        <li>Data arrives with the press’s publication delay, usually from 15 minutes to a few hours.</li>
      </Ul>
      <P>
        An error on the map? <In href={p("/contact")}>Let us know</In>.
      </P>
    </>
  );
}

function Contact({ lang, locale, info }: Props) {
  const p = (path: string) => localePath(locale, path);
  if (lang === "fr")
    return (
      <>
        <P>
          Pour toute question, écrivez à : <Mail v={info.email} />
        </P>
        <P>Nous répondons en général sous quelques jours. Précisez dans l’objet de quoi il s’agit :</P>
        <Ul>
          <li>
            <strong>Correction</strong> : une manifestation mal placée, un article sans rapport, un pays manquant.
            Joignez le lien de la page ou du lieu concerné.
          </li>
          <li>
            <strong>Vos données</strong> : accès, correction ou suppression de vos données personnelles (voir la page{" "}
            <In href={p("/legal/confidentialite")}>Confidentialité</In>). Vous pouvez aussi supprimer votre compte
            vous-même depuis votre profil.
          </li>
          <li>
            <strong>Contenu à retirer</strong> : un signalement ou une alerte abusive. Vous pouvez aussi utiliser les
            boutons « Signaler un abus » ou « Fausse alerte » sur la carte.
          </li>
          <li>
            <strong>Presse et partenariats</strong> : médias, ONG, chercheurs.
          </li>
        </Ul>
        <H2>Urgence</H2>
        <P>
          Cortège n’est pas un service d’urgence. Si vous ou quelqu’un d’autre êtes en danger, appelez les secours (112
          dans l’Union européenne).
        </P>
        <P>
          Éditeur et hébergeur : voir les <In href={p("/legal/mentions")}>mentions légales</In>.
        </P>
      </>
    );
  return (
    <>
      <P>
        For any question, write to: <Mail v={info.email} />
      </P>
      <P>We usually reply within a few days. Say in the subject what it is about:</P>
      <Ul>
        <li>
          <strong>Correction</strong>: a misplaced protest, an unrelated article, a missing country. Include the link to
          the page or place concerned.
        </li>
        <li>
          <strong>Your data</strong>: access, correction or deletion of your personal data (see the{" "}
          <In href={p("/legal/confidentialite")}>Privacy</In> page). You can also delete your account yourself from your
          profile.
        </li>
        <li>
          <strong>Content to remove</strong>: an abusive report or alert. You can also use the « Report abuse » or «
          False alert » buttons on the map.
        </li>
        <li>
          <strong>Press and partnerships</strong>: media, NGOs, researchers.
        </li>
      </Ul>
      <H2>Emergency</H2>
      <P>
        Cortège is not an emergency service. If you or someone else is in danger, call the emergency services (112 in
        the European Union).
      </P>
      <P>
        Publisher and host: see the <In href={p("/legal/mentions")}>legal notice</In>.
      </P>
    </>
  );
}
