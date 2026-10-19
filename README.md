# Cortège

Les manifestations du monde entier sur une carte, à partir des articles de presse
analysés par [GDELT](https://www.gdeltproject.org/), mise à jour toutes les 15 minutes.

## Développement

```bash
yarn
cp .env.example .env.local   # puis renseigner AUTH_SECRET
yarn dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `AUTH_SECRET` | oui | Secret de next-auth (`npx auth secret` pour en générer un). |
| `REDIS_URL` ou `KV_URL` | conseillé en production | Cache partagé des données GDELT. Sans Redis, chaque instance garde son cache en mémoire. |
| `GDELT_BASE_URL` | non | Miroir des fichiers GDELT, utile pour les tests. |
| `NEXT_PUBLIC_SITE_URL` | conseillé | Adresse publique (ex. `https://cortege.app`) pour les adresses canoniques, le sitemap et les aperçus. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | non | Connexion Google (bouton masqué sans elles). ID client OAuth « Application Web » ; URI de redirection `<site>/api/auth/callback/google`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | oui en production | E-mails de compte (vérification, mot de passe oublié). IONOS : `smtp.ionos.fr`, port 465. En local sans SMTP, les liens s'affichent dans la console. |
| `LEGAL_PUBLISHER`, `LEGAL_STATUS`, `LEGAL_ADDRESS`, `LEGAL_EMAIL`, `LEGAL_DIRECTOR` | oui, avant la mise en ligne | Éditeur, statut, adresse, contact et directeur de la publication, affichés dans les mentions légales et la politique de confidentialité. |
| `NEXT_PUBLIC_ADS_CONTACT` | non | Adresse de l'encart « Votre annonce ici ». |
| `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT` | non | Bloc Google AdSense, utilisé quand aucun annonceur direct n'est actif. |

Les comptes et les profils (suivis, réglages) sont stockés dans Redis : en production, Redis est
nécessaire pour qu'ils survivent aux redémarrages.

## Publicité

L'encart de la carte affiche, dans l'ordre :

1. un **annonceur direct** déclaré dans `lib/sponsors.ts`, ciblé sur le pays affiché ;
2. sinon un bloc **Google AdSense**, si les deux variables sont définies (dans l'Union
   européenne, activez le message de consentement « Confidentialité et messages » d'AdSense) ;
3. sinon l'encart **« Votre annonce ici »**, si `NEXT_PUBLIC_ADS_CONTACT` est défini.

Les affichages et les clics des annonceurs directs sont comptés par mois dans Redis
(`ads:<id>:<AAAA-MM>:views` et `:clicks`), sans aucune donnée sur les visiteurs.
Les suivis des utilisateurs ne servent jamais au ciblage : ils peuvent révéler des
opinions politiques, une catégorie de données protégée par le RGPD.

## Déploiement sur Vercel

1. Importer le dépôt sur [vercel.com/new](https://vercel.com/new) : Next.js et Yarn sont détectés seuls.
2. Ajouter `AUTH_SECRET` dans *Settings → Environment Variables*.
3. Ajouter une base Redis (par exemple Upstash depuis l'onglet *Storage*) et vérifier que
   `REDIS_URL` ou `KV_URL` est bien défini pour le projet.
4. Chaque push crée un déploiement de prévisualisation ; un merge sur `main` met la production à jour.

Sur Vercel, le pays du visiteur vient de l'en-tête `x-vercel-ip-country` : la langue et
le pays ouvert sur la carte s'adaptent sans configuration.

Les routes d'API ont une durée maximale de 60 secondes. Le premier calcul sur 72 h peut
la dépasser ; avec Redis, chaque fichier GDELT lu est gardé, et la requête suivante
reprend là où la précédente s'est arrêtée.

## Référencement

- **Une adresse par langue** : `/fr`, `/en`, `/es`, `/pt`, `/de`, `/ar`. Une adresse sans langue
  (`/`, anciens liens) redirige vers la langue du visiteur. Chaque page déclare ses versions
  dans les autres langues (`hreflang`) et son adresse canonique.
- **Pages pays indexables**, rendues côté serveur avec les chiffres du moment :
  `/fr/pays/france`, `/en/country/france`, `/de/land/frankreich`… et une page qui les liste
  (`/fr/pays`). Un pays sans manifestation récente est marqué `noindex`.
- `sitemap.xml` (pages et pays actifs, avec leurs versions linguistiques) et `robots.txt`.
- Données structurées schema.org (site, fil d'Ariane, listes) et images d'aperçu générées
  par page (`/api/og`).

Après la mise en ligne : déclarer le site et le sitemap dans Google Search Console et
Bing Webmaster Tools.

## Signalements des témoins

Les utilisateurs connectés peuvent signaler un point précis de la carte (cortège, rassemblement,
gaz lacrymogène, danger, rue bloquée), avec la taille de la foule et un lien vidéo facultatifs.

- Position arrondie à environ 100 m ; le compte de l'auteur n'est jamais publié.
- Chaque signalement expire seul (1 à 3 h selon le type) ; chaque confirmation le prolonge de
  30 min, jusqu'au double de sa durée. Trois signalements d'abus le retirent.
- 10 signalements par compte et par heure au plus ; un vote par compte et par signalement.
- Stockés dans Redis (`lib/reports.ts`) : sans Redis, ils restent en mémoire d'une seule instance.

## Annoncer une manifestation (`/fr/startup/create`)

Les utilisateurs connectés annoncent une manifestation à venir (titre, dates, point de
rendez-vous placé sur une carte, organisateur, lien officiel, déclaration aux autorités).

**Vérification de conformité** (`lib/compliance.ts`), lancée à chaque publication :

| Niveau | Effet | Exemples |
|---|---|---|
| Bloquant | non publiée, l'auteur voit quoi corriger | champ manquant, date passée, téléphone ou e-mail, appel à la violence, lien non https, doublon |
| Relecture | publiée après validation d'un modérateur | vocabulaire ambigu, majuscules, lien raccourci, plus de 7 jours |
| Information | publiée, avec une mention | manifestation non déclarée en France (art. L211-1 du code de la sécurité intérieure) |

- La vérification est relancée chaque jour sur toutes les annonces (`/api/cron/compliance`,
  planifiée dans `vercel.json`, protégée par `CRON_SECRET`).
- Modération : `/fr/startup/moderation`, réservée aux adresses de `ADMIN_EMAILS` (comptes vérifiés).
  Trois signalements d'abus renvoient une annonce en relecture.
- 5 annonces par compte et par jour ; effacement automatique deux jours après la manifestation.

## Vidéos et lives

Le panneau d'un lieu se termine par un carrousel de vidéos (`lib/videos.ts`), les lives d'abord :

| Source | Variable | Remarque |
|---|---|---|
| YouTube (vidéos et lives) | `YOUTUBE_API_KEY` | 100 unités de quota par recherche, résultats gardés 10 min par lieu |
| TikTok | `BRAVE_SEARCH_API_KEY` | TikTok n'ouvre pas sa recherche : les liens sont trouvés par Brave Search |
| Mastodon | `MASTODON_INSTANCE`, `MASTODON_TOKEN` | hashtags publics, filtrés sur le nom du lieu |
| Signalements | aucune | liens vidéo joints aux signalements à moins de 20 km |

Sans clé, la source est ignorée. Les vidéos ne sont jamais hébergées : le lecteur de la
plateforme ne se charge que lorsqu'on clique sur la vignette.

## Pages légales et cookies

- `/fr/legal/mentions`, `/fr/legal/confidentialite`, `/fr/legal/cookies` (textes en français et en
  anglais ; les autres langues affichent l'anglais avec une note). Les textes sont dans
  `app/components/legal/LegalContent.tsx` : à mettre à jour si les cookies, les données gardées
  ou les services tiers changent.
- Le site n'utilise que des cookies nécessaires (langue, connexion) : pas de consentement à
  recueillir, un simple bandeau d'information s'affiche une fois.
- Le premier suivi d'un pays ou d'un lieu demande un consentement explicite (les suivis peuvent
  révéler des opinions politiques) ; le serveur refuse un suivi sans lui.
- Depuis son profil, chacun peut télécharger ses données (`/api/profile/export`) et les supprimer.

Ces textes sont une base de travail : faites-les relire par un juriste avant une exploitation
commerciale.
