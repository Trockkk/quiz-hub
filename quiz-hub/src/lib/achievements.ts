import type { SaveData, SessionInput } from './storage'

export interface Achievement {
  id: string
  icon: string
  title: string
  description: string
  /** checked after each game, with the save already updated */
  check: (save: SaveData, last: SessionInput) => boolean
}

const plays = (s: SaveData, key = 'all') => s.stats[key]?.plays ?? 0
const portalsPlayed = (s: SaveData) => Object.keys(s.stats).filter((k) => k.startsWith('portal:')).length

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🎮', title: 'Première partie', description: 'Terminer une partie.', check: (s) => plays(s) >= 1 },
  { id: 'ten', icon: '🔟', title: 'Habitué', description: 'Jouer 10 parties.', check: (s) => plays(s) >= 10 },
  { id: 'fifty', icon: '🏅', title: 'Accro', description: 'Jouer 50 parties.', check: (s) => plays(s) >= 50 },
  { id: 'hundred', icon: '💯', title: 'Légende du Hub', description: 'Jouer 100 parties.', check: (s) => plays(s) >= 100 },
  { id: 'perfect', icon: '✨', title: 'Sans faute', description: 'Réussir une partie d’au moins 5 questions sans erreur.', check: (_, l) => l.answered >= 5 && l.correct === l.answered },
  { id: 'streak10', icon: '🔥', title: 'En feu', description: 'Enchaîner 10 bonnes réponses.', check: (_, l) => l.bestStreak >= 10 },
  { id: 'streak25', icon: '☄️', title: 'Inarrêtable', description: 'Enchaîner 25 bonnes réponses.', check: (_, l) => l.bestStreak >= 25 },
  { id: 'expert', icon: '🎓', title: 'Expert', description: 'Obtenir au moins 70 % de réussite en difficulté Expert (5 questions min.).', check: (_, l) => l.d === 4 && l.answered >= 5 && l.correct / l.answered >= 0.7 },
  { id: 'explorer', icon: '🧭', title: 'Explorateur', description: 'Jouer dans 5 catégories principales différentes.', check: (s) => portalsPlayed(s) >= 5 },
  { id: 'globetrotter', icon: '🌍', title: 'Globe-trotteur', description: 'Jouer 10 parties de drapeaux ou de capitales.', check: (s) => plays(s, 'portal:drapeaux') + plays(s, 'portal:capitales') >= 10 },
  { id: 'survivor20', icon: '❤️‍🔥', title: 'Survivant', description: 'Atteindre 20 bonnes réponses au Survivant.', check: (_, l) => l.gameId === 'survival' && l.correct >= 20 },
  { id: 'ladder', icon: '🪜', title: 'Au sommet', description: 'Gravir les 12 paliers du quiz progressif.', check: (_, l) => l.gameId === 'ladder' && l.correct >= 12 },
  { id: 'rare', icon: '💎', title: 'Perle rare', description: 'Marquer 300 points à la réponse rare.', check: (_, l) => l.gameId === 'rare' && l.score >= 300 },
  { id: 'boss', icon: '👹', title: 'Tueur de boss', description: 'Vaincre le boss final (finir les 15 épreuves).', check: (_, l) => l.gameId === 'boss' && l.answered >= 15 },
  { id: 'daily3', icon: '📅', title: 'Régulier', description: 'Jouer le défi du jour 3 jours de suite.', check: (s) => s.daily.streak >= 3 },
  { id: 'daily7', icon: '🗓️', title: 'Assidu', description: 'Jouer le défi du jour 7 jours de suite.', check: (s) => s.daily.streak >= 7 },
  { id: 'reflex', icon: '⚡', title: 'Réflexes d’acier', description: 'Moyenne de réaction sous 300 ms aux Réflexes.', check: (_, l) => l.gameId === 'reflex' && l.answered >= 5 && l.avgMs > 0 && l.avgMs < 300 },
  { id: 'logic', icon: '🧩', title: 'Logicien', description: 'Résoudre toutes les connexions d’une partie sans erreur.', check: (_, l) => l.gameId === 'connections' && l.answered > 0 && l.correct === l.answered },
]

export const newAchievements = (save: SaveData, last: SessionInput) => ACHIEVEMENTS.filter((a) => !save.achievements[a.id] && a.check(save, last))
