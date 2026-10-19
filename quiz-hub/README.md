# Quiz Hub

Site de culture générale et de mini-jeux. React 19 + TypeScript + Vite + Tailwind CSS v4.
100 % statique : pas de compte, pas de backend, données sauvegardées dans le navigateur (localStorage).

## Commandes

```bash
npm install
npm run dev      # serveur de développement
npm test         # tests unitaires (node:test, Node ≥ 22.18)
npm run build    # vérification TypeScript + build dans dist/
npm run preview  # prévisualiser le build
```

## Architecture

```
src/
  data/quiz-general.json   Questions et catégories (données pures, aucun code)
  games/
    types.ts               Contrat d'un mini-jeu (GameDefinition, GameProps)
    registry.ts            Liste des jeux disponibles
    quiz/                  Mini-jeu « Culture Générale »
      logic.ts             Logique pure : validation des données, tirage, score
      QuizGame.tsx         Partie (chronomètre, réponses, correction)
      QuizResults.tsx      Écran de résultats
  lib/
    storage.ts             Sauvegarde versionnée + validation + migrations
    store.ts               État global (useSave, recordSession…)
    router.ts              Routage par hash (#/stats, #/play/quiz/all…)
  pages/                   Tableau de bord, Jeux, Statistiques, Paramètres, Partie
  components/              Sidebar et composants d'interface
tests/                     Tests unitaires de la logique pure
```

### Ajouter des questions

Éditer `src/data/quiz-general.json`. `answer` est l’index de la bonne réponse dans `choices`
(les choix sont mélangés à chaque partie, l’ordre du fichier n’a donc pas d’importance).
Les questions mal formées sont ignorées avec un avertissement dans la console ; `npm test` vérifie que le fichier est valide.

### Ajouter un mini-jeu

1. Créer `src/games/<nom>/` avec un composant qui reçoit `GameProps` (`recordKey`, `modeId`, `onExit`).
2. À la fin d’une partie, appeler `recordSession({ key: recordKey, score, correct, total, date })` :
   records, statistiques et historique sont gérés automatiquement.
3. Exporter une `GameDefinition` dans `src/games/<nom>/index.ts` (composant chargé en `lazy`) et l’ajouter dans `src/games/registry.ts`.

Le jeu apparaît alors sur le tableau de bord, la page Jeux et les statistiques.

### Données sauvegardées

Clé `quizhub:save`, objet `{ version, settings, records, history }`. Tout est revalidé au chargement.
Si le format change : incrémenter `SAVE_VERSION` et ajouter une migration dans `storage.ts`.
Une sauvegarde illisible ou plus récente est copiée dans `quizhub:save:backup` avant réinitialisation.

## Publication sur GitHub Pages (gratuit)

1. Créer un dépôt GitHub et y pousser ce dossier sur la branche `main`.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Chaque push sur `main` lance `.github/workflows/deploy.yml` (tests + build + déploiement).

Le site est servi à `https://<utilisateur>.github.io/<dépôt>/`. Le build utilise des chemins relatifs
et un routage par hash : aucun réglage à modifier selon le nom du dépôt.
