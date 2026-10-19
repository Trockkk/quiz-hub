import { seeded } from '../rng.ts'
import type { Challenge, Config, Difficulty, GenContext } from '../types.ts'
import { anyQuestion, chronology, closest, guessYear, truefalse } from './culture.ts'
import { capital, flag, flagReverse } from './geo.ts'
import { higherLower, odd, sequence } from './logic.ts'

type Gen = (ctx: GenContext) => Challenge[]

/** Takes `n` challenges from a generator with a forced difficulty / answer type. */
function take(gen: Gen, ctx: GenContext, d: Difficulty, n = 1, extra: Partial<Config> = {}): Challenge[] {
  return gen({ ...ctx, config: { ...ctx.config, difficulty: d, count: n, answerType: 'qcm', hints: false, ...extra } }).slice(0, n)
}

/** UTC date: the daily challenge changes at the same moment for everyone. */
export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10)

/**
 * Same challenge for every player on a given day: the seed only depends on the date
 * (the player's history is ignored on purpose).
 */
export function daily(ctx: GenContext, dateKey = todayKey()): Challenge[] {
  const day: GenContext = { ...ctx, rng: seeded(`daily-${dateKey}`), recent: undefined }
  return [
    ...take((c) => [anyQuestion(c, 1), anyQuestion(c, 2), anyQuestion(c, 2), anyQuestion(c, 3)], day, 2, 4),
    ...take(flag, day, 2),
    ...take(capital, day, 2),
    ...take(truefalse, day, 3),
    ...take(closest, day, 2),
    ...take(chronology, day, 2),
    ...take(sequence, day, 2),
  ]
}

/** Five stages of three trials, each harder than the previous one. */
export function boss(ctx: GenContext): Challenge[] {
  const stage = (d: Difficulty): Challenge[] => [
    anyQuestion(ctx, d),
    ...take([flag, flagReverse, capital, odd, higherLower][d % 5], ctx, d),
    ...take([sequence, guessYear, closest, chronology, truefalse][(d + 2) % 5], ctx, d),
  ]
  return [...stage(1), ...stage(2), ...stage(3), ...stage(4), ...stage(4).map((c) => ({ ...c, id: `${c.id}-final` }))]
}

/** Boss rank from the share of the maximum score. */
export function bossRank(ratio: number): { rank: string; label: string } {
  if (ratio >= 0.9) return { rank: 'S', label: 'Légende' }
  if (ratio >= 0.75) return { rank: 'A', label: 'Champion' }
  if (ratio >= 0.55) return { rank: 'B', label: 'Aguerri' }
  if (ratio >= 0.35) return { rank: 'C', label: 'Apprenti' }
  return { rank: 'D', label: 'Recrue' }
}
