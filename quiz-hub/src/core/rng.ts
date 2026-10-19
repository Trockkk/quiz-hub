// Seeded random numbers: the same seed gives the same game (daily challenge, multiplayer, tests).

export function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 */
export function seeded(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const pick = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)]

export const sample = <T>(items: readonly T[], n: number, rng: () => number): T[] => shuffle(items, rng).slice(0, n)

/** Shuffle, but items whose id is in `recent` go last (fewer repeats between games). */
export function freshFirst<T extends { id: string }>(items: readonly T[], rng: () => number, recent?: Set<string>): T[] {
  const s = shuffle(items, rng)
  if (!recent?.size) return s
  return [...s.filter((i) => !recent.has(i.id)), ...s.filter((i) => recent.has(i.id))]
}

/** Puts `answer` among `wrong` at a random position. */
export function withAnswer(answer: string, wrong: string[], rng: () => number): { choices: string[]; answer: number } {
  const choices = shuffle([answer, ...wrong], rng)
  return { choices, answer: choices.indexOf(answer) }
}
