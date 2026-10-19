// Pure quiz logic: no React, no imports with runtime effects, so it can be unit-tested with plain Node.

export interface Category {
  id: string
  label: string
  icon: string
  color: string
}

export interface Question {
  id: string
  category: string
  question: string
  choices: string[]
  answer: number
  explanation?: string
}

export interface QuestionBank {
  categories: Category[]
  questions: Question[]
}

// eslint-disable-next-line typescript/no-explicit-any -- raw file content, every field is checked below
type Raw = Record<string, any> | null | undefined
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v : [])

/** Validates a question file. Malformed entries are dropped (and reported) instead of crashing the app. */
export function parseBank(raw: unknown): QuestionBank {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const categories = list(obj.categories)
    .filter((c) => isStr(c?.id) && isStr(c?.label) && isStr(c?.icon) && isStr(c?.color))
    .map((c) => ({ id: c!.id, label: c!.label, icon: c!.icon, color: c!.color }) as Category)
  const ids = new Set(categories.map((c) => c.id))
  const seen = new Set<string>()
  const questions: Question[] = []
  for (const q of list(obj.questions)) {
    const ok =
      !!q && isStr(q.id) && !seen.has(q.id) && ids.has(q.category) && isStr(q.question) &&
      Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.every(isStr) &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length &&
      (q.explanation === undefined || typeof q.explanation === 'string')
    if (!ok || !q) {
      console.warn('[quiz] question ignorée (format invalide) :', q)
      continue
    }
    seen.add(q.id)
    questions.push({ id: q.id, category: q.category, question: q.question, choices: q.choices, answer: q.answer, explanation: q.explanation })
  }
  return { categories, questions }
}

export function shuffle<T>(items: readonly T[], rng = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Picks `count` random questions and shuffles their choices (the answer index follows). */
export function buildRound(pool: readonly Question[], count: number, rng = Math.random): Question[] {
  return shuffle(pool, rng)
    .slice(0, count)
    .map((q) => {
      const order = shuffle(q.choices.map((_, i) => i), rng)
      return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) }
    })
}

export const BASE_POINTS = 100
export const MAX_SPEED_BONUS = 100

/** 100 points for a right answer, plus up to 100 for speed. */
export function pointsFor(correct: boolean, remainingMs: number, totalMs: number): number {
  if (!correct) return 0
  const ratio = Math.min(1, Math.max(0, remainingMs / totalMs))
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * ratio)
}
