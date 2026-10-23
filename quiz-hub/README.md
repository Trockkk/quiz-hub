# Quiz Hub

Plateforme de mini-jeux de culture générale : 37 jeux répartis en 9 catégories, plus de 500 questions rédigées,
195 pays, 35 territoires, près de 150 logos, défi quotidien, succès, statistiques et salons multijoueurs en temps réel.

- **Site** : React 19 + TypeScript + Vite + Tailwind CSS v4, 100 % statique (GitHub Pages).
- **Multijoueur** : Cloudflare Worker + Durable Objects (offre gratuite), dossier `server/`.
- **Pas de compte** : la progression est stockée dans le navigateur (localStorage), exportable depuis les Paramètres.

Site en ligne : https://trockkk.github.io/quiz-hub/

## Commandes

```bash
npm install
npm run dev        # site sur http://localhost:5173
npm test           # tests unitaires (node:test, Node ≥ 22.18) : contenus, générateurs, scores, moteur, salons
npm run build      # vérification TypeScript + build dans dist/
npm run preview    # build servi comme sur GitHub Pages : http://localhost:4173/quiz-hub/
npm run lint       # oxlint
npm run logos      # après modification de src/content/logos.json
npm run footballers  # régénère la base des footballeurs depuis Wikidata (quelques minutes)

# Serveur multijoueur local (dans un second terminal)
cd server && npm install && npm run dev   # http://localhost:8787 (déjà configuré dans .env.development)
```

## Jeux

| Catégorie | Jeux |
|---|---|
| Culture G | Quiz classique, Quiz par thème, Vrai ou faux, Quiz impossible, Le survivant, Quiz progressif (paliers + sécurisation), Quiz à indices, Classement des réponses, Le plus proche gagne, Quiz de rapidité, Devine l'année, Chronologie, La réponse rare |
| Logos et marques | Devine le logo (couleur, silhouette, zoom, révélation progressive) |
| Drapeaux du monde | Drapeau → pays, pays → drapeau, drapeaux et géographie, régions et territoires |
| Capitales | Pays → capitale, capitale → pays, capitale mystère (indices), capitales en chaîne |
| Logique | Connexions, Intrus, Suite logique (générée), Classement mystère, Plus haut ou plus bas, Détective, Défi de mémoire |
| Mots | Mot mystère, Anagrammes, Connexions |
| Rapidité | Réflexes (signal, faux signaux, choix), Calcul mental, Mémoire, Quiz de rapidité, Plus haut ou plus bas |
| Multijoueur | Duel des réponses rares, Duel de catégories (« le plus de réponses » ou « dernier debout »), + 12 jeux jouables en salon |
| Quotidien | Défi du jour (identique pour tous, série de jours, partage sans réponses), Boss final (rang S → D) |

Chaque jeu ouvre d'abord un **écran de configuration** (difficulté, nombre de questions, durée totale, temps par question,
thèmes, type de réponse, indices, explications, mélange, variante) qui n'affiche que les réglages utiles et mémorise
les préférences par jeu. « Illimité » existe séparément pour la durée totale et pour le temps par question.

**Difficulté** : elle change le contenu (questions plus pointues, pays et logos moins connus), les propositions
(moins nombreuses en facile, plus proches en difficile, drapeaux ressemblants en expert), les règles (tolérance des
estimations, erreurs autorisées aux Connexions, nombre d'indices) et le barème (×1, ×1,5, ×2, ×3).

**Score** : 100 points × difficulté par bonne réponse, jusqu'à +25 % pour la vitesse (une bonne réponse compte donc
toujours plus que la rapidité), bonus de série plafonné, −25 % par indice. Les records ne sont comparés qu'entre
parties jouées avec **les mêmes paramètres**.

## Architecture

```
src/
  core/                 Logique pure, partagée par le site, le serveur et les tests (aucun import React)
    types.ts            Types : contenus, épreuves (« challenges »), réponses, configuration, jeux
    catalog.ts          Catalogue des jeux et portails : options, règles, générateurs  ← ajouter un jeu ici
    games/*.ts          Générateurs : produisent les épreuves d'une partie (graine aléatoire → partie reproductible)
    scoring.ts          Correction des réponses et barème unique
    engine.ts           Déroulé d'une partie solo (chrono, séries, vies, paliers, fin de partie)
    text.ts             Comparaison tolérante des réponses écrites (accents, casse, articles, fautes légères)
    protocol.ts, room.ts  Multijoueur : messages, vue publique sans réponses, logique d'un salon
  content/              Données (JSON) : questions par thème, vrai/faux, indices, mots, connexions, intrus,
                        événements, estimations, listes, réponses rares, logos, enquêtes, classements, pays, territoires
  play/                 Écran de jeu, vues par type d'épreuve, résultats, jeux spéciaux (mémoire, réflexes)
  pages/                Accueil, portails, configuration, partie, multijoueur, statistiques, paramètres
  lib/                  Sauvegarde versionnée (v2, migration depuis v1), succès, routage, médias
  multi/client.ts       Connexion WebSocket au serveur (reconnexion automatique)
server/                 Cloudflare Worker + Durable Object « RoomObject » (un objet par salon)
tests/                  Tests unitaires
```

### Ajouter du contenu

- **Questions QCM** : `src/content/questions/<thème>.json` — `{ id, d (1-4), q, a, w: [3 mauvaises réponses, la plus proche d'abord], alt?, x? (explication), src? }`.
- **Vrai/faux, indices, mots, connexions, intrus, événements, estimations, listes, réponses rares, enquêtes** : un fichier par type dans `src/content/`.
- **Pays / territoires** : `countries.json` (193 États membres de l'ONU + 2 observateurs), `territories.json` (avec leur rattachement).
- **Logos** : ajouter `{ slug, name, alt?, d, sector }` dans `logos.json` (slug [Simple Icons](https://simpleicons.org)), puis `npm run logos`.

`npm test` vérifie tout le contenu : identifiants uniques, réponses présentes, chaque épreuve générée est jouable et
la bonne réponse est bien acceptée, à chaque difficulté et pour chaque type de réponse.

### Ajouter un mini-jeu

1. Écrire un générateur `(ctx) => Challenge[]` dans `src/core/games/` (ou un composant dédié comme `play/Memory.tsx`).
2. Ajouter une entrée dans `GAMES` (`src/core/catalog.ts`) : titre, portail, règles, options du formulaire, valeurs par défaut.

Le jeu apparaît alors dans l'accueil, la recherche, son portail, les statistiques et (si `modes` contient `multi`) en salon.

## Multijoueur

GitHub Pages ne sert que des fichiers statiques : le temps réel passe par un serveur Cloudflare (offre gratuite :
100 000 requêtes/jour, 13 000 Go·s/jour pour les Durable Objects, messages WebSocket entrants comptés 20 pour 1,
pas de carte bancaire). Les WebSockets « hibernent » : un salon inactif ne consomme rien, et les pings sont traités par
Cloudflare sans réveiller le salon.

**Équité et anti-triche** : le serveur génère les questions (identiques pour tous), n'envoie jamais la bonne réponse
avant la clôture de la question, vérifie chaque réponse (format, délai + 0,5 s de tolérance réseau, une seule réponse
par question), calcule tous les scores, et identifie chaque joueur par un jeton secret haché (reconnexion avec son score).
L'hôte est réattribué automatiquement s'il se déconnecte ; un joueur qui part n'est plus attendu.

### Mise en service (une seule fois)

1. Créer un compte gratuit sur https://dash.cloudflare.com/sign-up.
2. Dans un terminal :
   ```bash
   cd quiz-hub/server
   npm install
   npx wrangler login     # ouvre le navigateur pour autoriser Wrangler
   npm run deploy         # affiche l'adresse : https://quiz-hub-multi.<votre-sous-domaine>.workers.dev
   ```
3. Sur GitHub : **Settings → Secrets and variables → Actions → Variables → New repository variable**
   `MP_URL` = l'adresse obtenue (sans `/` final). Ce n'est pas un secret : elle est visible dans le site.
4. Relancer le workflow **Deploy to GitHub Pages** (onglet Actions → Run workflow) ou pousser un commit.

Optionnel — redéploiement automatique du serveur quand les règles changent : créer un jeton API Cloudflare
(modèle « Edit Cloudflare Workers ») et l'ajouter en **secret** `CLOUDFLARE_API_TOKEN`, ainsi que `CLOUDFLARE_ACCOUNT_ID`.
Sans ces secrets, le workflow `deploy-server.yml` ne fait rien ; pensez alors à relancer `npm run deploy` après
toute modification de `src/core` ou `src/content` (le serveur embarque les mêmes règles).

Si le site est servi depuis une autre adresse, l'ajouter à `ALLOWED_ORIGINS` dans `server/wrangler.jsonc`.

## Publication sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` (à la racine du dépôt) installe, teste, compile et publie `quiz-hub/dist`
à chaque push sur `main`. `base` vaut `/quiz-hub/` pour le build (nom du dépôt) ; le routage par `#` évite toute
erreur 404. Les anciennes adresses `#/play/quiz/<catégorie>` redirigent vers le quiz classique.

## Données et licences

- Drapeaux : [flag-icons](https://github.com/lipis/flag-icons) (MIT) — les drapeaux sont dans le domaine public.
- Logos : [Simple Icons](https://simpleicons.org) (CC0). Les marques restent la propriété de leurs détenteurs ;
  usage d'identification dans un quiz non commercial. Les logos qui écrivent le nom de la marque ont été exclus.
- Populations : estimations ONU (World Population Prospects), arrondies ; superficies : CIA World Factbook.
  Les comparaisons « plus haut / plus bas » exigent un écart d'au moins 15 % pour ne pas dépendre des arrondis.
- Rareté des « réponses rares » : barème éditorial explicite (ou notoriété des pays pour les questions générées),
  affiché au joueur — pas une statistique réelle.
- Questions : rédigées pour le projet, avec explication et source quand un chiffre ou un record est cité.
