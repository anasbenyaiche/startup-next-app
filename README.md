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
