# Architecture

Cortège est une application Next.js (App Router) : les pages sont rendues sur le
serveur, les composants interactifs (carte, accueil 3D, SOS) tournent dans le navigateur.

## Couches

```
app/(root)/…        pages (composants serveur) : lisent les données, passent des props
app/api/…           routes JSON lues par le navigateur (carte, alertes, vidéos…)
app/actions/…       server actions : vérifient la session, appellent lib/, renvoient un résultat typé
app/components/…    composants React (clients pour la plupart)
  hooks/            hooks partagés (usePolling)
lib/                logique métier, sans React
  core/             socle technique : cache Redis, stockage, e-mail, limites de débit,
                    erreurs codées, résultat des actions, drapeaux de fonctionnalités
  geo/              pays (FIPS ↔ ISO), numéros d'urgence, distances
  i18n/             dictionnaires (un fichier par langue), chemins localisés, langue de la requête
  news/             GDELT, agrégation des manifestations, vidéos, SEO, données de l'accueil
  community/        contenus des utilisateurs : signalements, alertes SOS, annonces,
                    vérification de conformité, couvre-feux
  users/            comptes, profils, rôles et journal d'administration
  content/          textes légaux, annonceurs
```

Le sens des dépendances est toujours le même : `app/` → `lib/<domaine>` → `lib/core`.
Un module de `lib/` n'importe jamais de `app/`.

## Conventions

- **Serveur uniquement.** Tout module de `lib/` qui touche Redis, les secrets ou le réseau
  commence par `import "server-only";` : l'importer depuis un composant client casse le build
  au lieu d'exposer du code serveur. Les modules purs importés par le navigateur
  (`compliance`, `features`, `geo/countries`, `geo/emergency`, `i18n`, `news/hero`, `content/sponsors`)
  n'ont pas ce garde.
- **Erreurs attendues = codes.** Un module métier lance une `CodedError` (`ReportError`, `AlertError`…).
  Les server actions passent par `runForUser` (`lib/core/action.ts`) qui la convertit en
  `{ ok: false, error: code }` ; le navigateur affiche le message traduit. Toute autre erreur remonte.
- **Rôles relus à chaque appel.** Les actions d'administration relisent le compte dans la base :
  un rôle retiré ou un compte banni perd ses droits immédiatement.
- **Limites de débit** : `underLimit(clé, max, fenêtre)` dans `lib/core/rate-limit.ts`, une seule implémentation.
- **Pseudonymes** : `authorHash` (`lib/core/identity.ts`) — le compte n'est jamais publié avec un contenu.
- **Redis facultatif.** Sans `REDIS_URL`, le stockage et les limites restent en mémoire (une seule instance) :
  pratique en local et dans les tests.
- **Fonctionnalités en préparation** derrière un drapeau (`lib/core/features.ts`, variables `NEXT_PUBLIC_FEATURE_*`).
- **Hydratation** : ce qui dépend de la langue ou de l'heure est calculé sur le serveur et passé en props
  (`LocalTime` pour les heures). Un module client ne doit pas exporter de constantes utilisées par une page serveur.
- **Données en direct** : `usePolling(url, intervalle, onData)` ; pas de requête quand l'onglet est caché.

## Tests et vérifications

- `yarn test` : tests unitaires (vitest) dans `tests/`, sur les modules purs et le mode mémoire.
- `yarn verify` : lint + types + tests. La CI (`.github/workflows/ci.yml`) ajoute le build.
- Format : Prettier, 120 colonnes (`.prettierrc`).

## Limite connue

Les composants clients importent `lib/i18n`, qui embarque les six dictionnaires. Le jour où le poids
devient gênant, passer à la page seulement le dictionnaire de sa langue.
