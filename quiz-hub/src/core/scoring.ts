import { findAnswer, matches } from './text.ts'
import type { Challenge, Difficulty, Grade, Response, Rules } from './types.ts'

/** A right answer is worth 100 × this. Scores are only compared between identical settings anyway. */
export const DIFF_MULT: Record<Difficulty, number> = { 1: 1, 2: 1.5, 3: 2, 4: 3 }
/** "Réponse rare": points by rarity tier (before the difficulty multiplier). */
export const TIER_POINTS: Record<Difficulty, number> = { 1: 10, 2: 25, 3: 50, 4: 100 }
export const TIER_LABELS: Record<Difficulty, string> = { 1: 'Courante', 2: 'Peu courante', 3: 'Rare', 4: 'Très rare' }
/** Points per valid answer in list games. */
export const LIST_POINTS = 20
/** Speed can add at most this share of the base points: being right always matters more. */
export const MAX_SPEED_SHARE = 0.25
/** Reference time for the speed bonus when the question has no timer. */
export const UNTIMED_REF_MS = 15_000
/** Each revealed hint removes this share of the points (never below 25 %). */
export const HINT_COST = 0.25

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const hintFactor = (used = 0) => Math.max(0.25, 1 - HINT_COST * used)

/** Pairs of items in the right relative order / all pairs. */
export function orderRatio(values: number[], order: number[], dir: 'asc' | 'desc'): number {
  let ok = 0
  let total = 0
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      total++
      const a = values[order[i]]
      const b = values[order[j]]
      if (dir === 'asc' ? a <= b : a >= b) ok++
    }
  }
  return total ? ok / total : 0
}

export function grade(ch: Challenge, r: Response): Grade {
  switch (ch.kind) {
    case 'mcq': {
      if (r.kind !== 'mcq') break
      const ok = r.choice === ch.answer
      return { ratio: ok ? hintFactor(r.hintsUsed) : 0, correct: ok }
    }
    case 'text': {
      if (r.kind !== 'text' || r.text === null) break
      const ok = ch.numeric
        ? ch.accept.some((a) => Number(a) === Number(r.text!.replace(',', '.').trim()))
        : matches(ch.accept, r.text, ch.exclusive)
      if (!ok) return { ratio: 0, correct: false }
      let ratio = hintFactor(r.hintsUsed) * (r.usedChoices ? 0.5 : 1)
      // Clues: the first is free, each extra one costs an equal share.
      if (ch.clues?.length) ratio *= (ch.clues.length - Math.max(1, r.cluesShown ?? 1) + 1) / ch.clues.length
      // Tries: -20 % per failed try.
      ratio *= Math.max(0.2, 1 - 0.2 * Math.max(0, (r.tries ?? 1) - 1))
      return { ratio, correct: true, matched: ch.display }
    }
    case 'estimate': {
      if (r.kind !== 'estimate' || r.value === null || !Number.isFinite(r.value)) break
      const ratio = clamp01(1 - Math.abs(r.value - ch.answer) / ch.scale)
      return { ratio, correct: ratio >= 0.8 }
    }
    case 'order': {
      if (r.kind !== 'order' || r.order.length !== ch.items.length) break
      const ratio = orderRatio(ch.values, r.order, ch.dir)
      return { ratio, correct: ratio === 1 }
    }
    case 'list': {
      if (r.kind !== 'list') break
      // Re-validate every entry: never trust the client's list.
      const valid = new Set<number>()
      for (const f of r.found) {
        const i = findAnswer(ch.answers.map((a) => [a.n, ...(a.alt ?? [])]), f, ch.exclusive)
        if (i >= 0) valid.add(i)
      }
      return { ratio: clamp01(valid.size / Math.min(10, ch.answers.length)), correct: valid.size > 0, fixedPoints: valid.size * LIST_POINTS }
    }
    case 'rare': {
      if (r.kind !== 'rare' || r.text === null) break
      const i = findAnswer(ch.answers.map((a) => [a.n, ...(a.alt ?? [])]), r.text, ch.exclusive)
      if (i < 0) return { ratio: 0, correct: false }
      const a = ch.answers[i]
      return { ratio: a.tier / 4, correct: true, fixedPoints: TIER_POINTS[a.tier], matched: a.n, tier: a.tier }
    }
    case 'connections': {
      if (r.kind !== 'connections') break
      const ratio = clamp01((r.solved / ch.groups.length) * (1 - 0.1 * r.mistakes))
      return { ratio, correct: r.solved === ch.groups.length }
    }
  }
  return { ratio: 0, correct: false }
}

export interface ScoreInput {
  grade: Grade
  d: Difficulty
  /** time taken to answer */
  timeMs: number
  /** question timer, null when unlimited */
  limitMs: number | null
  /** current streak including this answer */
  streak: number
  rules?: Rules
}

export interface ScoreBreakdown {
  base: number
  speed: number
  streak: number
  total: number
}

export function scoreAnswer({ grade: g, d, timeMs, limitMs, streak, rules = {} }: ScoreInput): ScoreBreakdown {
  const mult = DIFF_MULT[d]
  if (g.fixedPoints !== undefined) {
    const base = Math.round(g.fixedPoints * mult)
    return { base, speed: 0, streak: 0, total: base }
  }
  if (g.ratio <= 0) return { base: 0, speed: 0, streak: 0, total: 0 }
  const base = Math.round(100 * mult * g.ratio)
  const speed = rules.noSpeedBonus ? 0 : Math.round(base * MAX_SPEED_SHARE * clamp01(1 - timeMs / (limitMs ?? UNTIMED_REF_MS)))
  const step = rules.streakStep ?? 0.1
  const cap = rules.streakCap ?? 0.5
  const streakBonus = g.correct && streak >= 3 ? Math.round(base * Math.min(cap, step * (streak - 2))) : 0
  return { base, speed, streak: streakBonus, total: base + speed + streakBonus }
}

/** Ladder (quiz progressif): value of each level. */
export const LADDER = [100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7500, 10000]
