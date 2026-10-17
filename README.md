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
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | pour les profils | Application OAuth GitHub ; URL de retour `<site>/api/auth/callback/github`. |
| `NEXT_PUBLIC_ADS_CONTACT` | non | Adresse de l'encart « Votre annonce ici ». |
| `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT` | non | Bloc Google AdSense, utilisé quand aucun annonceur direct n'est actif. |

Les profils (suivis, réglages) sont stockés dans Redis : en production, Redis est
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
