// Helpers shared by the game generators.
import { freshFirst, pick, sample, shuffle, withAnswer } from './rng.ts'
import { normalize } from './text.ts'
import type { Challenge, Config, Country, Difficulty, GenContext, McqChallenge, Question, TextChallenge } from './types.ts'

/** Target content difficulty with a little spill-over from the level below (never above). */
export const BAND: Record<Difficulty, Difficulty[]> = { 1: [1], 2: [1, 2], 3: [2, 3], 4: [3, 4] }

/** Endless games generate this many challenges (more than anyone answers in one game). */
export const ENDLESS = 150

export const wanted = (config: Config, fallback = 10) => (config.count > 0 ? config.count : fallback)

/**
 * Picks `n` items for difficulty `d`: mostly level d, some level d-1, unseen items first.
 * Falls back to any level when the band is too small, so a game never comes out short.
 */
export function pickByDifficulty<T extends { id: string; d: Difficulty }>(items: T[], d: Difficulty, n: number, ctx: GenContext): T[] {
  const band = items.filter((i) => BAND[d].includes(i.d))
  const scored = freshFirst(band, ctx.rng, ctx.recent).map((item, i) => ({
    item,
    // recency keeps priority (index), the exact level is preferred over the one below
    score: i / band.length + (item.d === d ? 0 : 0.6) + ctx.rng() * 0.4,
  }))
  const chosen = scored.sort((a, b) => a.score - b.score).map((s) => s.item).slice(0, n)
  if (chosen.length >= n) return chosen
  const rest = freshFirst(items.filter((i) => !chosen.includes(i)), ctx.rng, ctx.recent)
  return [...chosen, ...rest.slice(0, n - chosen.length)]
}

/** Picks `n` items with difficulty rising from 1 to 4 over the game. */
export function pickProgressive<T extends { id: string; d: Difficulty }>(items: T[], n: number, ctx: GenContext): T[] {
  const out: T[] = []
  const used = new Set<string>()
  for (let i = 0; i < n; i++) {
    const d = Math.min(4, 1 + Math.floor((i * 4) / Math.max(n, 4))) as Difficulty
    const candidates = freshFirst(items.filter((x) => !used.has(x.id) && x.d === d), ctx.rng, ctx.recent)
    const next = candidates[0] ?? freshFirst(items.filter((x) => !used.has(x.id)), ctx.rng, ctx.recent)[0]
    if (!next) break
    used.add(next.id)
    out.push(next)
  }
  return out
}

/** Text version of a challenge, with the propositions kept for the "mixed" answer mode. */
export function toText(mcq: McqChallenge, accept: string[], config: Config, exclusive: string[] = []): TextChallenge {
  const display = mcq.choices[mcq.answer]
  const { kind: _k, answer: _a, choices, choiceFlags: _f, ...base } = mcq
  return {
    ...base,
    kind: 'text',
    accept,
    display,
    exclusive: [...exclusive, ...choices.filter((c) => c !== display)],
    choices: config.answerType === 'mixed' ? choices : undefined,
    hints: config.hints ? [`Commence par « ${display.replace(/^(l'|le |la |les )/i, '').charAt(0).toUpperCase()} »`, `${display.length} caractères`] : undefined,
  }
}

/** Applies the chosen answer type (QCM / typed / mixed). */
export const asAnswerType = (mcq: McqChallenge, accept: string[], config: Config, exclusive?: string[]): Challenge =>
  config.answerType === 'qcm' ? mcq : toText(mcq, accept, config, exclusive)

/** Number of propositions: easy games show fewer, closer options come with difficulty. */
export const choiceCount = (d: Difficulty) => (d === 1 ? 3 : 4)

export function questionToChallenge(q: Question, config: Config, ctx: GenContext): Challenge {
  const wrong = config.difficulty === 1 ? sample(q.w, choiceCount(1) - 1, ctx.rng) : q.w.slice(0, 3)
  const { choices, answer } = withAnswer(q.a, wrong, ctx.rng)
  const mcq: McqChallenge = { kind: 'mcq', id: q.id, d: q.d, theme: q.t, prompt: q.q, choices, answer, explanation: q.x, source: q.src }
  return asAnswerType(mcq, [q.a, ...(q.alt ?? [])], config)
}

export const themeFilter = <T extends { t: string }>(items: T[], config: Config) =>
  config.themes.length ? items.filter((i) => config.themes.includes(i.t)) : items

// ---------- Countries ----------

export const countryNames = (c: Country) => [c.name, ...(c.alt ?? [])]
export const capitalNames = (c: Country) => [c.capital, ...(c.capitalAlt ?? [])]

/** Countries whose tier fits the difficulty (with spill-over), as id-able items. */
export const countryPool = (countries: Country[]) => countries.map((c) => ({ ...c, id: c.code, d: c.tier }))

/** Wrong options for a country: harder levels pick neighbours and look-alikes. */
export function countryDistractors(target: Country, all: Country[], d: Difficulty, n: number, rng: () => number, similar?: string[][]): Country[] {
  const others = all.filter((c) => c.code !== target.code)
  let ordered: Country[]
  if (d === 1) {
    ordered = shuffle(others.filter((c) => c.continent !== target.continent && c.tier <= 2), rng)
  } else if (d === 2) {
    ordered = shuffle(others.filter((c) => c.continent === target.continent), rng)
  } else {
    const look = similar?.find((g) => g.includes(target.code)) ?? []
    const alike = shuffle(others.filter((c) => look.includes(c.code)), rng)
    const near = shuffle(others.filter((c) => c.continent === target.continent && !look.includes(c.code)), rng).sort(
      (a, b) => Math.abs(a.tier - target.tier) - Math.abs(b.tier - target.tier),
    )
    ordered = d === 4 ? [...alike, ...near] : [...near.slice(0, 2), ...alike, ...near.slice(2)]
  }
  const filled = [...ordered, ...shuffle(others, rng)]
  return [...new Map(filled.map((c) => [c.code, c])).values()].slice(0, n)
}

/** Flags that are easily confused (used by the expert level). */
export const SIMILAR_FLAGS = [
  ['td', 'ro', 'ad', 'md'],
  ['id', 'mc', 'pl', 'sg'],
  ['nl', 'lu', 'ru', 'fr', 'hr', 'rs', 'sk', 'si'],
  ['au', 'nz', 'fj', 'tv'],
  ['ie', 'ci', 'it', 'mx', 'ne', 'in'],
  ['sn', 'ml', 'gn', 'cm', 'bj', 'gh'],
  ['no', 'is', 'dk', 'se', 'fi', 'fo'],
  ['co', 'ec', 've'],
  ['ar', 'uy', 'sv', 'ni', 'hn', 'gt'],
  ['eg', 'sy', 'iq', 'ye', 'sd', 'jo', 'ps'],
  ['qa', 'bh', 'lv'],
  ['at', 'lb', 'lv', 'pe', 'ca'],
  ['us', 'lr', 'my', 'pr'],
  ['tr', 'tn', 'dz', 'mr', 'pk'],
  ['bd', 'jp', 'pw', 'kr'],
  ['et', 'gh', 'bo', 'lt', 'gn', 'ml'],
  ['si', 'sk', 'rs', 'ru'],
  ['kp', 'cu', 'pr', 'cl', 'tg'],
]

/** Normalized first letter. */
export const initial = (s: string) => normalize(s).charAt(0).toUpperCase()

export { pick, sample, shuffle, withAnswer }
