// Solo game flow as pure functions: the UI only calls them and renders the state.
import { LADDER, grade, scoreAnswer, type ScoreBreakdown } from './scoring.ts'
import type { Challenge, Config, Grade, Response, Rules } from './types.ts'

export type EndReason = 'done' | 'time' | 'error' | 'lives' | 'stopped'

export interface Turn {
  challenge: Challenge
  response: Response | null
  grade: Grade
  points: ScoreBreakdown
  timeMs: number
}

export interface EngineState {
  challenges: Challenge[]
  index: number
  turns: Turn[]
  phase: 'question' | 'feedback' | 'over'
  endReason: EndReason | null
  /** set by an answer that ends the game once its feedback is read */
  pendingEnd: EndReason | null
  score: number
  streak: number
  bestStreak: number
  lives: number | null
  questionStart: number
  gameStart: number
  ladder: { secured: number; securesLeft: number } | null
}

export interface EngineCtx {
  config: Config
  rules: Rules
  now: number
}

export function start(challenges: Challenge[], { rules, now }: EngineCtx): EngineState {
  return {
    challenges,
    index: 0,
    turns: [],
    phase: challenges.length ? 'question' : 'over',
    endReason: challenges.length ? null : 'done',
    pendingEnd: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: rules.lives ?? null,
    questionStart: now,
    gameStart: now,
    ladder: rules.ladder ? { secured: 0, securesLeft: 3 } : null,
  }
}

export const current = (s: EngineState): Challenge | undefined => s.challenges[s.index]

/** Deadline of the current question (ms timestamp) or null when unlimited. */
export const questionDeadline = (s: EngineState, c: Config) => (c.questionTime === null ? null : s.questionStart + c.questionTime * 1000)
export const gameDeadline = (s: EngineState, c: Config) => (c.totalTime === null ? null : s.gameStart + c.totalTime * 1000)

/** What a timeout submits: partial work counts for lists, orders and connections. */
export function timeoutResponse(ch: Challenge, draft: Response | null): Response | null {
  return draft && draft.kind === ch.kind && (ch.kind === 'list' || ch.kind === 'order' || ch.kind === 'connections') ? draft : null
}

export function answer(s: EngineState, response: Response | null, { config, rules, now }: EngineCtx): EngineState {
  const ch = current(s)
  if (!ch || s.phase !== 'question') return s
  const g: Grade = response ? grade(ch, response) : { ratio: 0, correct: false }
  const streak = g.correct ? s.streak + 1 : 0
  const timeMs = Math.max(0, now - s.questionStart)
  const limitMs = config.questionTime === null ? null : config.questionTime * 1000
  let points = scoreAnswer({ grade: g, d: ch.d, timeMs, limitMs, streak, rules })
  let score = s.score + points.total
  let pendingEnd: EndReason | null = null
  let lives = s.lives

  if (s.ladder) {
    // Ladder: the score is the value of the highest level reached; a mistake falls back to the secured amount.
    const level = s.turns.filter((t) => t.grade.correct).length + (g.correct ? 1 : 0)
    score = g.correct ? LADDER[Math.min(level, LADDER.length) - 1] : s.ladder.secured
    points = { base: score - s.score, speed: 0, streak: 0, total: score - s.score }
    if (!g.correct) pendingEnd = 'error'
  } else if (!g.correct && rules.endOnError) {
    pendingEnd = 'error'
  } else if (!g.correct && lives !== null) {
    lives -= 1
    if (lives <= 0) pendingEnd = 'lives'
  }

  return {
    ...s,
    phase: 'feedback',
    turns: [...s.turns, { challenge: ch, response, grade: g, points, timeMs }],
    score,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    lives,
    pendingEnd,
  }
}

export function next(s: EngineState, now: number): EngineState {
  if (s.phase !== 'feedback') return s
  if (s.pendingEnd) return { ...s, phase: 'over', endReason: s.pendingEnd }
  if (s.index + 1 >= s.challenges.length) return { ...s, phase: 'over', endReason: 'done' }
  return { ...s, index: s.index + 1, phase: 'question', questionStart: now }
}

/** The whole-game timer ran out: the unanswered question does not count. */
export const timeUp = (s: EngineState): EngineState => (s.phase === 'over' ? s : { ...s, phase: 'over', endReason: 'time' })

export const stop = (s: EngineState): EngineState => (s.phase === 'over' ? s : { ...s, phase: 'over', endReason: 'stopped' })

/** Ladder: bank the current amount (3 times per game). */
export function secure(s: EngineState): EngineState {
  if (!s.ladder || s.ladder.securesLeft <= 0 || s.score <= s.ladder.secured) return s
  return { ...s, ladder: { secured: s.score, securesLeft: s.ladder.securesLeft - 1 } }
}

export interface Summary {
  score: number
  correct: number
  answered: number
  avgMs: number
  timeMs: number
  bestStreak: number
  perTheme: Record<string, [number, number]>
  seen: string[]
}

export function summarize(s: EngineState): Summary {
  const perTheme: Record<string, [number, number]> = {}
  for (const t of s.turns) {
    if (!t.challenge.theme) continue
    const [c, n] = perTheme[t.challenge.theme] ?? [0, 0]
    perTheme[t.challenge.theme] = [c + (t.grade.correct ? 1 : 0), n + 1]
  }
  const timeMs = s.turns.reduce((a, t) => a + t.timeMs, 0)
  return {
    score: s.score,
    correct: s.turns.filter((t) => t.grade.correct).length,
    answered: s.turns.length,
    avgMs: s.turns.length ? Math.round(timeMs / s.turns.length) : 0,
    timeMs,
    bestStreak: s.bestStreak,
    perTheme,
    seen: s.turns.map((t) => t.challenge.id),
  }
}

/** Emoji summary for sharing (no answers revealed). */
export const gridOf = (s: EngineState) => s.turns.map((t) => (t.grade.correct ? "🟩" : t.grade.ratio > 0 ? "🟨" : "🟥")).join("")

/** The right answer, in words, for the feedback panel. */
export function correctAnswer(ch: Challenge): string | null {
  switch (ch.kind) {
    case 'mcq': return ch.choices[ch.answer]
    case 'text': return ch.display
    default: return null
  }
}
