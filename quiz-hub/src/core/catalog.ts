// The game catalogue. To add a mini-game: write a generator (or a custom component), then add one entry here.
import * as culture from './games/culture.ts'
import * as geo from './games/geo.ts'
import * as logic from './games/logic.ts'
import * as special from './games/special.ts'
import type { Config, GameMeta, PortalId, Rules } from './types.ts'

export const DEFAULT_CONFIG: Config = {
  difficulty: 2,
  count: 10,
  questionTime: 15,
  totalTime: null,
  themes: [],
  answerType: 'qcm',
  hints: false,
  explanations: true,
  shuffle: true,
  variant: '',
}

const COUNTS = [5, 10, 15, 20, 30]
const Q_TIMES = [5, 10, 15, 30, null]
const T_TIMES = [30, 60, 120, 300, null]
const ALL_ANSWERS = ['qcm' as const, 'text' as const, 'mixed' as const]

export interface Portal {
  id: PortalId
  title: string
  icon: string
  color: string
  description: string
}

export const PORTALS: Portal[] = [
  { id: 'culture', title: 'Culture G', icon: '🧠', color: '#8b5cf6', description: 'Tous les quiz de culture générale : classique, vrai ou faux, survie, indices, estimations…' },
  { id: 'logos', title: 'Logos et marques', icon: '🏷️', color: '#f43f5e', description: 'Reconnaissez les logos de près de 150 marques, en couleur ou en silhouette.' },
  { id: 'drapeaux', title: 'Drapeaux du monde', icon: '🚩', color: '#10b981', description: '195 pays et plus de 30 territoires : drapeaux, continents, capitales.' },
  { id: 'capitales', title: 'Capitales', icon: '🏙️', color: '#14b8a6', description: 'Pays → capitale, capitale → pays, indices géographiques et enchaînements.' },
  { id: 'logique', title: 'Jeux de logique', icon: '🧩', color: '#06b6d4', description: 'Suites, intrus, connexions, classements et enquêtes à résoudre.' },
  { id: 'mots', title: 'Jeux de mots', icon: '🔤', color: '#eab308', description: 'Mot mystère, anagrammes et associations de mots.' },
  { id: 'rapidite', title: 'Défis de rapidité', icon: '⚡', color: '#f97316', description: 'Réflexes, calcul mental, mémoire et questions contre la montre.' },
  { id: 'multi', title: 'Jeux multijoueurs', icon: '👥', color: '#6366f1', description: 'Salons privés en temps réel : affrontez vos amis avec un simple code.' },
  { id: 'quotidien', title: 'Défis quotidiens', icon: '📅', color: '#ec4899', description: 'Un défi identique pour tous chaque jour, et le boss final.' },
]

const streak = (step: number, cap: number): Rules => ({ streakStep: step, streakCap: cap })

export const GAMES: GameMeta[] = [
  // ---------- Culture G ----------
  {
    id: 'classic', title: 'Quiz classique', tagline: 'Le grand mélange de culture générale, sur un ou plusieurs thèmes.', icon: '❓', portal: 'culture', type: 'quiz', modes: ['solo', 'multi'],
    rules: ['Une question, plusieurs propositions (ou une réponse à écrire).', 'Bonne réponse : 100 points × difficulté. Répondre vite rapporte jusqu’à 25 % de bonus.', 'Les séries de bonnes réponses donnent un bonus supplémentaire.'],
    options: { difficulty: true, count: COUNTS, customCount: true, questionTime: Q_TIMES, totalTime: T_TIMES, themes: true, answerType: ALL_ANSWERS, hints: true, explanations: true, shuffle: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: culture.classic,
  },
  {
    id: 'themed', title: 'Quiz par thème', tagline: 'Choisissez vos thèmes : les questions montent en difficulté.', icon: '🎯', portal: 'culture', type: 'quiz', modes: ['solo'],
    rules: ['Sélectionnez un ou plusieurs thèmes avant de lancer.', 'Les questions vont du plus facile au plus difficile (sauf si le mélange est activé).', 'Vos statistiques par thème sont enregistrées.'],
    options: { difficulty: true, count: COUNTS, customCount: true, questionTime: Q_TIMES, themes: true, answerType: ALL_ANSWERS, hints: true, explanations: true, shuffle: true },
    defaults: { themes: ['histoire'], shuffle: false, count: 15 }, engine: streak(0.1, 0.5), generate: culture.themed,
  },
  {
    id: 'truefalse', title: 'Vrai ou faux', tagline: 'Des affirmations de plus en plus piégeuses. Tranchez vite !', icon: '⚖️', portal: 'culture', alsoIn: ['rapidite'], type: 'quiz', modes: ['solo', 'multi'],
    fixedDifficulty: 'Progressive : de facile à expert au fil de la partie',
    rules: ['Une affirmation : vraie ou fausse ?', 'Elles deviennent plus difficiles au fil de la partie.', 'Chaque réponse est expliquée.'],
    options: { count: COUNTS, customCount: true, questionTime: Q_TIMES, themes: true, explanations: true },
    defaults: { count: 15, questionTime: 10 }, engine: streak(0.1, 0.5), generate: culture.truefalse,
  },
  {
    id: 'impossible', title: 'Le quiz impossible', tagline: 'Questions d’expert et gros bonus de série.', icon: '💀', portal: 'culture', type: 'quiz', modes: ['solo'],
    fixedDifficulty: 'Expert uniquement',
    rules: ['Uniquement des questions de niveau expert.', 'Chaque bonne réponse d’affilée augmente le bonus de série (+25 % par réponse, jusqu’à +150 %).'],
    options: { count: COUNTS, questionTime: Q_TIMES, themes: true, answerType: ALL_ANSWERS, explanations: true },
    defaults: { difficulty: 4, count: 10, questionTime: 30 }, engine: streak(0.25, 1.5), generate: culture.impossible,
  },
  {
    id: 'survival', title: 'Le survivant', tagline: 'Une seule erreur et c’est terminé. Jusqu’où irez-vous ?', icon: '❤️‍🔥', portal: 'culture', type: 'quiz', modes: ['solo'],
    fixedDifficulty: 'Progressive',
    rules: ['Les questions s’enchaînent sans limite, de plus en plus difficiles.', 'La partie s’arrête à la première erreur (ou quand le temps est écoulé).', 'Votre record : le nombre de bonnes réponses d’affilée.'],
    options: { questionTime: Q_TIMES, themes: true, answerType: ALL_ANSWERS, explanations: true },
    defaults: { count: 0, questionTime: 15 }, engine: { endOnError: true, ...streak(0.05, 1) }, generate: culture.rising,
  },
  {
    id: 'ladder', title: 'Le quiz progressif', tagline: '12 paliers jusqu’à 10 000 points. Sécurisez vos gains !', icon: '🪜', portal: 'culture', type: 'quiz', modes: ['solo'],
    fixedDifficulty: 'Progressive : 3 paliers par niveau',
    rules: ['Chaque palier vaut plus que le précédent (100 → 10 000 points).', 'Vous pouvez sécuriser votre gain 3 fois, ou vous arrêter à tout moment.', 'Une erreur vous ramène au dernier gain sécurisé.'],
    options: { questionTime: Q_TIMES, themes: true, answerType: ALL_ANSWERS, explanations: true },
    defaults: { count: 12, questionTime: 30 }, engine: { ladder: true, noSpeedBonus: true }, generate: culture.ladder,
  },
  {
    id: 'clues', title: 'Le quiz à indices', tagline: 'Devinez une personne, un lieu ou un objet avec le moins d’indices possible.', icon: '🕵️', portal: 'culture', type: 'quiz', modes: ['solo'],
    rules: ['Le premier indice est offert ; chaque indice supplémentaire réduit les points.', 'Une mauvaise réponse dévoile l’indice suivant.', 'Expert : seulement les 3 indices les plus vagues et 2 essais.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, themes: true, answerType: ['text', 'mixed', 'qcm'], explanations: true },
    defaults: { count: 8, questionTime: 60, answerType: 'mixed' }, engine: { noSpeedBonus: true }, generate: culture.clues,
  },
  {
    id: 'listing', title: 'Classement des réponses', tagline: 'Citez un maximum de réponses avant la fin du chrono.', icon: '📋', portal: 'culture', alsoIn: ['rapidite'], type: 'quiz', modes: ['solo', 'multi'],
    rules: ['Une catégorie (« les pays d’Europe »…) : tapez un maximum de réponses.', '20 points par réponse valide × difficulté ; les fautes de frappe légères sont tolérées.', 'À la fin, les réponses manquantes sont affichées.'],
    options: { difficulty: true, count: [1, 2, 3, 5], questionTime: [60, 90, 120, 180, null] },
    defaults: { count: 3, questionTime: 90 }, engine: { noSpeedBonus: true }, generate: culture.listing,
  },
  {
    id: 'closest', title: 'Le plus proche gagne', tagline: 'Estimez des nombres : plus vous êtes proche, plus vous marquez.', icon: '📏', portal: 'culture', type: 'estimation', modes: ['solo', 'multi'],
    rules: ['Donnez une estimation chiffrée.', 'Le score diminue avec l’écart à la bonne réponse.', 'La tolérance se resserre avec la difficulté (±60 % en facile, ±20 % en expert).'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, explanations: true },
    defaults: { count: 8, questionTime: 30 }, engine: { noSpeedBonus: true }, generate: culture.closest,
  },
  {
    id: 'speed', title: 'Le quiz de rapidité', tagline: 'Un maximum de bonnes réponses en temps limité.', icon: '⏱️', portal: 'culture', alsoIn: ['rapidite'], type: 'rapidite', modes: ['solo'],
    fixedDifficulty: 'Progressive',
    rules: ['Le chrono global tourne : enchaînez les questions.', 'Bonus de vitesse et de série ; la difficulté monte au fil des réponses.'],
    options: { totalTime: [30, 60, 120, 300], themes: true },
    defaults: { count: 0, totalTime: 60, questionTime: null, explanations: false }, engine: streak(0.1, 0.5), generate: culture.rising,
  },
  {
    id: 'guessyear', title: 'Devine l’année', tagline: 'Retrouvez l’année d’un événement historique.', icon: '📆', portal: 'culture', type: 'estimation', modes: ['solo', 'multi'],
    rules: ['Écrivez une année (négative pour avant J.-C.).', 'Score selon l’écart : ±80 ans de tolérance en facile, ±15 ans en expert.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES },
    defaults: { count: 8, questionTime: 30 }, engine: { noSpeedBonus: true }, generate: culture.guessYear,
  },
  {
    id: 'chronology', title: 'La chronologie', tagline: 'Remettez les événements dans le bon ordre.', icon: '🗓️', portal: 'culture', alsoIn: ['logique'], type: 'logique', modes: ['solo', 'multi'],
    rules: ['Classez les événements du plus ancien au plus récent.', 'Points selon la précision : chaque paire bien ordonnée compte.', 'Plus la difficulté est élevée, plus il y a d’événements et plus ils sont proches.'],
    options: { difficulty: true, count: [3, 5, 8, 10], questionTime: [30, 60, 90, null] },
    defaults: { count: 5, questionTime: 60 }, engine: { noSpeedBonus: true }, generate: culture.chronology,
  },
  {
    id: 'rare', title: 'La réponse rare', tagline: 'Une bonne réponse, oui. Mais la plus rare possible !', icon: '💎', portal: 'culture', type: 'quiz', modes: ['solo', 'multi'],
    rules: ['Chaque question admet plusieurs réponses valides.', 'Courante : 10 pts · Peu courante : 25 · Rare : 50 · Très rare : 100 (× difficulté).', 'La rareté vient d’un barème éditorial affiché après la réponse ; une réponse fausse ne rapporte rien.'],
    options: { difficulty: true, count: [3, 5, 8, 10], questionTime: [15, 30, 60, null] },
    defaults: { count: 5, questionTime: 30 }, engine: { noSpeedBonus: true }, generate: culture.rare,
  },

  // ---------- Logos ----------
  {
    id: 'logo', title: 'Devine le logo', tagline: 'Près de 150 logos : couleur, silhouette ou révélation progressive.', icon: '🏷️', portal: 'logos', type: 'visuel', modes: ['solo', 'multi'],
    rules: ['Facile : logo en couleur, propositions variées.', 'Difficile : silhouette et marques du même secteur.', 'Expert : silhouette zoomée. Mode « révélation » : le logo se dévoile peu à peu, répondre tôt rapporte plus.'],
    options: { difficulty: true, count: COUNTS, customCount: true, questionTime: Q_TIMES, answerType: ALL_ANSWERS, hints: true, variants: [
      { id: 'full', label: 'Logo complet', description: 'Le logo est visible dès le début.' },
      { id: 'reveal', label: 'Révélation progressive', description: 'Le logo est flou puis se précise ; le bonus de vitesse compte davantage.' },
    ] },
    defaults: { variant: 'full' }, engine: streak(0.1, 0.5), generate: geo.logo,
  },

  // ---------- Flags ----------
  {
    id: 'flag', title: 'Devine le drapeau', tagline: 'Retrouvez le pays à partir de son drapeau.', icon: '🚩', portal: 'drapeaux', type: 'visuel', modes: ['solo', 'multi'],
    rules: ['Facile : pays connus, propositions d’autres continents.', 'Normal : propositions du même continent.', 'Expert : pays méconnus et drapeaux qui se ressemblent.'],
    options: { difficulty: true, count: COUNTS, customCount: true, questionTime: Q_TIMES, answerType: ALL_ANSWERS, hints: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: geo.flag,
  },
  {
    id: 'flag-reverse', title: 'Trouve le drapeau', tagline: 'Un nom de pays : choisissez le bon drapeau.', icon: '🏳️', portal: 'drapeaux', type: 'visuel', modes: ['solo'],
    rules: ['Le nom d’un pays s’affiche : cliquez sur son drapeau.', 'En difficile et expert, les drapeaux proposés se ressemblent.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, hints: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: geo.flagReverse,
  },
  {
    id: 'flag-geo', title: 'Drapeaux et géographie', tagline: 'Un drapeau : trouvez son continent ou sa capitale.', icon: '🧭', portal: 'drapeaux', type: 'visuel', modes: ['solo'],
    rules: ['Une question sur deux porte sur le continent, l’autre sur la capitale.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, answerType: ALL_ANSWERS },
    defaults: {}, engine: streak(0.1, 0.5), generate: geo.flagGeo,
  },
  {
    id: 'territories', title: 'Régions et territoires', tagline: 'Groenland, Écosse, Hong Kong… des drapeaux qui ne sont pas des pays.', icon: '🗺️', portal: 'drapeaux', type: 'visuel', modes: ['solo'],
    rules: ['Territoires, régions autonomes et nations constitutives (35 drapeaux).', 'Leur rattachement est précisé : aucun n’est présenté comme un État souverain.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, answerType: ALL_ANSWERS, hints: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: geo.territories,
  },

  // ---------- Capitals ----------
  {
    id: 'capital', title: 'Pays → capitale', tagline: 'Trouvez la capitale de chaque pays.', icon: '🏛️', portal: 'capitales', type: 'quiz', modes: ['solo', 'multi'],
    rules: ['Facile : grands pays, 3 propositions. Expert : petits États, capitales voisines.', 'En saisie libre, les variantes reconnues sont acceptées (Pékin/Beijing, Kiev/Kyiv…).', 'Les pays dont la capitale est contestée sont exclus.'],
    options: { difficulty: true, count: COUNTS, customCount: true, questionTime: Q_TIMES, answerType: ALL_ANSWERS, hints: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: geo.capital,
  },
  {
    id: 'capital-reverse', title: 'Capitale → pays', tagline: 'À quel pays appartient cette capitale ?', icon: '🔁', portal: 'capitales', type: 'quiz', modes: ['solo'],
    rules: ['Une capitale s’affiche : retrouvez son pays.', 'Les pays homonymes de leur capitale (Monaco…) sont exclus.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, answerType: ALL_ANSWERS, hints: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: geo.capitalReverse,
  },
  {
    id: 'capital-clue', title: 'Capitale mystère', tagline: 'Continent, population, initiales : trouvez la capitale.', icon: '🔍', portal: 'capitales', type: 'quiz', modes: ['solo'],
    rules: ['Des indices géographiques se dévoilent un à un.', 'Moins vous utilisez d’indices, plus vous marquez.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, answerType: ['text', 'mixed'] },
    defaults: { count: 8, questionTime: 60, answerType: 'text' }, engine: { noSpeedBonus: true }, generate: geo.capitalClue,
  },
  {
    id: 'capital-chain', title: 'Capitales en chaîne', tagline: 'Chaque capitale commence par la dernière lettre de la précédente.', icon: '⛓️', portal: 'capitales', type: 'mots', modes: ['solo'],
    fixedDifficulty: 'Toutes les capitales',
    rules: ['Tapez une capitale, puis une autre qui commence par sa dernière lettre (Paris → Stockholm → Manama…).', 'Pas de répétition. 20 points par maillon.'],
    options: { questionTime: [60, 120, 180, null] },
    defaults: { count: 1, questionTime: 120 }, engine: { noSpeedBonus: true }, generate: geo.capitalChain,
  },

  // ---------- Logic ----------
  {
    id: 'connections', title: 'Connexions', tagline: '16 éléments, 4 groupes cachés. Trouvez les liens.', icon: '🔗', portal: 'logique', alsoIn: ['mots'], type: 'logique', modes: ['solo'],
    rules: ['Sélectionnez 4 éléments qui partagent un point commun, puis validez.', 'Erreurs autorisées : 6 (facile) à 2 (expert).', 'Points selon le nombre de groupes trouvés et les erreurs.'],
    options: { difficulty: true, count: [1, 3, 5], questionTime: [60, 120, 300, null] },
    defaults: { count: 3, questionTime: null }, engine: { noSpeedBonus: true }, generate: logic.connections,
  },
  {
    id: 'odd', title: 'L’intrus', tagline: 'Un élément ne colle pas avec les autres. Lequel ?', icon: '🙃', portal: 'logique', type: 'logique', modes: ['solo'],
    rules: ['Trouvez l’élément qui n’appartient pas à la catégorie.', 'L’explication s’affiche après chaque réponse.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, explanations: true },
    defaults: {}, engine: streak(0.1, 0.5), generate: logic.odd,
  },
  {
    id: 'sequence', title: 'La suite logique', tagline: 'Nombres et lettres : trouvez l’élément suivant.', icon: '🔢', portal: 'logique', type: 'logique', modes: ['solo', 'multi'],
    rules: ['Facile : additions simples. Normal : multiplications, carrés, alternances.', 'Difficile : Fibonacci, suites entrelacées. Expert : nombres premiers, triangulaires…', 'Suites générées à l’infini : jamais deux parties identiques.'],
    options: { difficulty: true, count: COUNTS, customCount: true, questionTime: Q_TIMES, answerType: ['qcm', 'text'], explanations: true },
    defaults: { questionTime: 30 }, engine: streak(0.1, 0.5), generate: logic.sequence,
  },
  {
    id: 'ranking', title: 'Le classement mystère', tagline: 'Classez pays, planètes, fleuves ou sommets selon un critère.', icon: '📊', portal: 'logique', type: 'logique', modes: ['solo'],
    rules: ['Classez les éléments dans l’ordre demandé.', 'Les valeurs proviennent de sources citées (ONU, NASA…).', 'Facile : 3 éléments très différents. Expert : 6 éléments proches.'],
    options: { difficulty: true, count: [3, 5, 8], questionTime: [30, 60, 90, null] },
    defaults: { count: 5, questionTime: 60 }, engine: { noSpeedBonus: true }, generate: logic.ranking,
  },
  {
    id: 'higherlower', title: 'Plus haut ou plus bas', tagline: 'Qui l’emporte ? Populations, superficies, altitudes…', icon: '↕️', portal: 'logique', alsoIn: ['rapidite'], type: 'rapidite', modes: ['solo', 'multi'],
    rules: ['Deux éléments, une question : lequel a la plus grande valeur ?', 'Plus la difficulté est élevée, plus les valeurs sont proches.', 'Mode survie : la première erreur met fin à la partie.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, explanations: true, variants: [
      { id: 'classic', label: 'Partie classique', description: 'Un nombre fixe de duels.' },
      { id: 'survival', label: 'Survie', description: 'Sans fin : une erreur et c’est terminé.' },
    ] },
    defaults: { variant: 'classic', questionTime: 10 }, engine: streak(0.1, 0.5), generate: logic.higherLower,
  },
  {
    id: 'detective', title: 'Le détective', tagline: 'Recoupez les indices et résolvez l’énigme.', icon: '🔎', portal: 'logique', type: 'logique', modes: ['solo'],
    rules: ['Lisez l’histoire et les indices.', 'Une seule conclusion est logique : trouvez-la.'],
    options: { difficulty: true, count: [1, 3, 5], questionTime: [60, 120, null], explanations: true },
    defaults: { count: 3, questionTime: null }, engine: { noSpeedBonus: true }, generate: logic.detective,
  },
  {
    id: 'memory', title: 'Le défi de mémoire', tagline: 'Mémorisez une séquence qui s’allonge à chaque manche.', icon: '🧠', portal: 'logique', alsoIn: ['rapidite'], type: 'rapidite', modes: ['solo'],
    rules: ['Observez la séquence, puis reproduisez-la.', 'Elle s’allonge d’un élément à chaque réussite. Trois vies.', 'Facile : 4 symboles affichés longtemps. Expert : 9 symboles, affichage éclair.'],
    options: { difficulty: true, variants: [
      { id: 'symbols', label: 'Symboles', description: 'Des emojis à mémoriser.' },
      { id: 'numbers', label: 'Chiffres', description: 'Une suite de chiffres.' },
      { id: 'colors', label: 'Couleurs', description: 'Des cases colorées qui s’allument.' },
    ] },
    defaults: { variant: 'symbols' }, engine: {}, custom: 'memory',
  },

  // ---------- Words ----------
  {
    id: 'mystery-word', title: 'Le mot mystère', tagline: 'Devinez le mot : chaque erreur dévoile un nouvel indice.', icon: '🔠', portal: 'mots', type: 'mots', modes: ['solo'],
    rules: ['Un premier indice est donné ; chaque essai raté en révèle un autre.', 'Moins d’essais et moins d’indices = plus de points.'],
    options: { difficulty: true, count: [3, 5, 10], questionTime: [60, 120, null], hints: true, variants: [
      { id: 'limited', label: '6 essais', description: 'Au 6e échec, le mot est perdu.' },
      { id: 'unlimited', label: 'Essais illimités', description: 'Les points baissent à chaque essai, sans élimination.' },
    ] },
    defaults: { count: 5, questionTime: null, variant: 'limited' }, engine: { noSpeedBonus: true }, generate: logic.mysteryWord,
  },
  {
    id: 'anagram', title: 'Anagrammes', tagline: 'Remettez les lettres dans l’ordre.', icon: '🔀', portal: 'mots', type: 'mots', modes: ['solo'],
    rules: ['Les lettres d’un mot sont mélangées : retrouvez-le.', 'Mots plus longs et plus rares en difficile et expert.'],
    options: { difficulty: true, count: COUNTS, questionTime: Q_TIMES, hints: true },
    defaults: { questionTime: 30 }, engine: streak(0.1, 0.5), generate: logic.anagram,
  },

  // ---------- Speed ----------
  {
    id: 'reflex', title: 'Réflexes', tagline: 'Appuyez dès que le signal apparaît. Gare aux faux signaux !', icon: '⚡', portal: 'rapidite', type: 'rapidite', modes: ['solo'],
    rules: ['Attendez le signal vert, puis appuyez le plus vite possible.', 'Appuyer trop tôt ou sur un faux signal coûte une pénalité.', 'Le score dépend de votre temps de réaction moyen.'],
    options: { difficulty: true, count: [5, 10, 15], variants: [
      { id: 'simple', label: 'Signal simple', description: 'Un seul type de signal.' },
      { id: 'decoys', label: 'Faux signaux', description: 'Des signaux rouges à ne pas toucher.' },
      { id: 'choice', label: 'Choix', description: 'Appuyez sur la flèche indiquée.' },
    ] },
    defaults: { count: 10, variant: 'decoys' }, engine: {}, custom: 'reflex',
  },
  {
    id: 'mental-math', title: 'Calcul mental', tagline: 'Un maximum d’opérations justes contre la montre.', icon: '➗', portal: 'rapidite', type: 'rapidite', modes: ['solo'],
    rules: ['Facile : additions. Normal : tables de multiplication. Difficile : divisions, nombres à deux chiffres. Expert : carrés, pourcentages.', 'Le chrono global tourne : enchaînez !'],
    options: { difficulty: true, totalTime: [30, 60, 120, 300], answerType: ['text', 'qcm'] },
    defaults: { count: 0, totalTime: 60, questionTime: null, answerType: 'text', explanations: false }, engine: streak(0.05, 0.5), generate: logic.mentalMath,
  },

  // ---------- Daily ----------
  {
    id: 'daily', title: 'Le défi du jour', tagline: 'Les mêmes 10 épreuves pour tout le monde, aujourd’hui.', icon: '📅', portal: 'quotidien', type: 'quiz', modes: ['daily'],
    fixedDifficulty: 'Mixte, identique pour tous',
    rules: ['10 épreuves variées, identiques pour tous les joueurs du jour (heure UTC).', 'Seule votre première partie du jour compte pour la série de jours.', 'Partagez votre résultat sans dévoiler les réponses.'],
    options: {}, defaults: { count: 10, questionTime: 25, explanations: true, answerType: 'qcm' }, engine: streak(0.1, 0.5),
    generate: (ctx) => special.daily(ctx),
  },
  {
    id: 'boss', title: 'Le boss final', tagline: 'Cinq étapes, tous les types d’épreuves, trois vies.', icon: '👹', portal: 'quotidien', type: 'quiz', modes: ['solo'],
    fixedDifficulty: 'Progressive : facile → expert',
    rules: ['15 épreuves mêlant quiz, drapeaux, estimations, chronologie, logique…', 'Chaque étape est plus difficile. Trois erreurs et le boss vous terrasse.', 'Un rang (S, A, B, C, D) récompense votre performance.'],
    options: { questionTime: [15, 30, null] }, defaults: { count: 15, questionTime: 30 }, engine: { lives: 3, ...streak(0.1, 0.5) }, generate: special.boss,
  },

  // ---------- Multiplayer only ----------
  {
    id: 'duel-rare', title: 'Duel des réponses rares', tagline: 'Même question pour tous : la réponse la plus rare l’emporte.', icon: '💎', portal: 'multi', type: 'quiz', modes: ['multi'], multiOnly: true,
    rules: ['Chacun donne une réponse valide, la plus rare possible.', 'Barème par rareté (10 à 100 points).', 'Si plusieurs joueurs donnent la même réponse, ils se partagent ses points.'],
    options: { difficulty: true, count: [3, 5, 8], questionTime: [20, 30, 45] }, defaults: { count: 5, questionTime: 30 }, engine: { noSpeedBonus: true }, generate: culture.rare,
  },
  {
    id: 'duel-categories', title: 'Duel de catégories', tagline: 'Une catégorie tirée au sort : citez un maximum de réponses, ou soyez le dernier debout.', icon: '🥊', portal: 'multi', type: 'quiz', modes: ['multi'], multiOnly: true,
    rules: ['« Le plus de réponses » : chacun tape un maximum de réponses valides dans le temps imparti.', '« Dernier debout » : chacun son tour, une réponse inédite en 15 s, sinon éliminé.'],
    options: { difficulty: true, count: [1, 2, 3], questionTime: [45, 60, 90], variants: [
      { id: 'most', label: 'Le plus de réponses', description: 'Tout le monde joue en même temps.' },
      { id: 'last', label: 'Dernier debout', description: 'Tour par tour, élimination.' },
    ] },
    defaults: { count: 2, questionTime: 60, variant: 'most' }, engine: { noSpeedBonus: true }, generate: culture.listing,
  },
]

export const getGame = (id: string | undefined) => GAMES.find((g) => g.id === id)

/** Engine rules depending on the chosen variant. */
export function rulesFor(game: GameMeta, config: Config): Rules {
  if (game.id === 'higherlower' && config.variant === 'survival') return { ...game.engine, endOnError: true }
  return game.engine
}

/** Full config for a game: global defaults < game defaults < saved preferences, then sanitized. */
export function configFor(game: GameMeta, saved?: Partial<Config>): Config {
  const c: Config = { ...DEFAULT_CONFIG, ...game.defaults, ...saved }
  const o = game.options
  const allowed = <T>(v: T, list: T[] | undefined, fallback: T) => (list === undefined || list.includes(v) ? v : fallback)
  const base = { ...DEFAULT_CONFIG, ...game.defaults }
  if (!o.difficulty) c.difficulty = base.difficulty
  if (!o.count) c.count = base.count
  else if (!o.customCount || c.count < 1 || c.count > 100) c.count = allowed(c.count, o.count, base.count)
  c.questionTime = o.questionTime ? allowed(c.questionTime, o.questionTime, base.questionTime) : base.questionTime
  c.totalTime = o.totalTime ? allowed(c.totalTime, o.totalTime, base.totalTime) : base.totalTime
  c.answerType = o.answerType ? allowed(c.answerType, o.answerType, o.answerType[0]) : 'qcm'
  if (!o.themes) c.themes = []
  if (!o.hints) c.hints = false
  if (!o.explanations) c.explanations = base.explanations
  if (!o.shuffle) c.shuffle = base.shuffle
  c.variant = o.variants ? allowed(c.variant, o.variants.map((v) => v.id), o.variants[0].id) : ''
  return c
}

/**
 * Record key: only results obtained with the same settings are compared
 * (difficulty, number of questions, timers, themes, answer type, hints, variant).
 */
export function configKey(game: GameMeta, c: Config): string {
  const parts = [
    `d${c.difficulty}`,
    `n${c.count}`,
    `q${c.questionTime ?? '∞'}`,
    `t${c.totalTime ?? '∞'}`,
    c.answerType,
    c.hints ? 'h' : '',
    c.variant,
    [...c.themes].sort().join('+'),
  ]
  return `${game.id}|${parts.filter(Boolean).join('|')}`
}
