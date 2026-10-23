import { DIFFICULTY_LABELS, type Config, type GameMeta } from '../core/types'

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const fmtTime = (s: number | null) => (s === null ? 'illimité' : s >= 60 ? `${s / 60} min` : `${s} s`)

export const fmtMs = (ms: number) => (ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)

export const ANSWER_LABELS = { qcm: 'QCM', text: 'Saisie libre', mixed: 'Saisie + propositions' }

/** Human summary of the settings that matter for the record: shown next to every score. */
export function describeConfig(game: GameMeta, c: Config): string {
  const o = game.options
  const parts: string[] = []
  parts.push(o.difficulty ? DIFFICULTY_LABELS[c.difficulty] : (game.fixedDifficulty?.split(' :')[0] ?? 'Standard'))
  if (o.count) parts.push(`${c.count} ${game.id === 'listing' || game.id.startsWith('duel') || game.id === 'foot-squads' ? 'manches' : game.id === 'foot-chain' ? 'runs' : game.id === 'connections' || game.id === 'detective' ? 'énigmes' : 'questions'}`)
  if (o.totalTime) parts.push(`partie ${fmtTime(c.totalTime)}`)
  if (o.questionTime) parts.push(`${fmtTime(c.questionTime)} par ${game.id === 'listing' || game.id === 'foot-squads' ? 'manche' : game.id === 'foot-chain' ? 'tour' : 'question'}`)
  if (o.answerType && o.answerType.length > 1) parts.push(ANSWER_LABELS[c.answerType])
  if (o.variants) parts.push(o.variants.find((v) => v.id === c.variant)?.label ?? '')
  if (o.themes && c.themes.length) parts.push(`${c.themes.length} thème${c.themes.length > 1 ? 's' : ''}`)
  if (c.hints && o.hints) parts.push('indices')
  return parts.filter(Boolean).join(' · ')
}
