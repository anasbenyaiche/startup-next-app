# Contenu éditorial

Ce dossier contient les textes écrits à la main. Pour publier, ajoute un fichier ici,
puis fais un commit sur `main` (ou une PR) : Vercel redéploie et le texte est en ligne.
Pas besoin de toucher au code.

Les fichiers dont le nom commence par `_` sont des modèles : ils ne sont jamais publiés.

## Bilans de la semaine (`content/bilans/`)

1. Copie `bilans/_modele.md` en `bilans/AAAA-MM-JJ-un-titre-court.md`
   (par exemple `bilans/2026-11-23-semaine-47.md`). Le nom du fichier devient l'adresse :
   `/fr/bilans/2026-11-23-semaine-47`.
2. Remplis l'en-tête :
   - `titre` : le titre affiché (obligatoire) ;
   - `date` : `AAAA-MM-JJ`. Un bilan daté dans le futur n'apparaît qu'à cette date ;
   - `langue` : `fr` (par défaut), `en`, `es`, `pt`, `de` ou `ar` ;
   - `resume` : une ou deux phrases, reprises dans la liste et sur Google ;
   - `pays` : codes ISO des pays évoqués, séparés par des virgules (`FR, DE, PT`).
     Le bilan apparaît alors sur la page de chacun de ces pays ;
   - `brouillon: oui` pour le garder hors ligne.
3. Écris le texte en Markdown sous l'en-tête : `## Titre de partie`, `**gras**`,
   `[lien](/fr/pays/france)`, listes avec `-`.

Conseils pour AdSense et Google : 3 à 5 mouvements marquants, du contexte (pourquoi, depuis
quand, ce qui est attendu), tes propres mots, et des liens vers les pages pays et les sources.
Au moins 300 mots. Ne recopie pas des articles.

## Texte de contexte d'un pays (`content/pays/`)

1. Copie `pays/_modele.md` en `pays/<CODE ISO>.<langue>.md`, par exemple `pays/FR.fr.md`
   pour la page française de la France, `pays/DE.fr.md` pour l'Allemagne, `pays/PT.en.md`
   pour la page anglaise du Portugal.
2. Remplis `maj` (date de mise à jour, `AAAA-MM-JJ`) et écris un ou deux paragraphes :
   le climat social du moment, les acteurs habituels (syndicats, collectifs), les
   mobilisations récurrentes.

Le texte s'affiche en haut de la page du pays, dans cette langue seulement. Une page pays
qui a un texte écrit à la main est toujours proposée à Google, même les jours calmes.
