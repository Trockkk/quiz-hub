// Tolerant comparison of typed answers: accents, case, spaces, articles, small typos.

const ARTICLES = /^(l|le|la|les|un|une|des|the|el|los|las)\s+/

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/&/g, ' et ')
    .replace(/['’`´.\-_/,()!?:;"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLES, '')
    .replace(/\bst\b/g, 'saint')
    .replace(/\bste\b/g, 'sainte')
    .replace(/\s+/g, '')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Typos tolerated for an answer of this (normalized) length. */
export const tolerance = (len: number) => (len <= 4 ? 0 : len <= 8 ? 1 : 2)

/**
 * Index of the candidate the guess designates, or -1.
 * Exact matches win; a typo only counts when it designates a single candidate
 * and the guess is not exactly another known name (`exclusive`), e.g. "Niger" never matches "Nigeria".
 */
export function findAnswer(candidates: string[][], guess: string, exclusive: string[] = []): number {
  const g = normalize(guess)
  if (!g) return -1
  const norm = candidates.map((names) => names.map(normalize))
  const exact = norm.findIndex((names) => names.includes(g))
  if (exact >= 0) return exact
  if (exclusive.some((e) => normalize(e) === g)) return -1
  let best = -1
  let bestDist = Infinity
  let tie = false
  norm.forEach((names, i) => {
    for (const n of names) {
      const d = levenshtein(g, n)
      if (d > tolerance(n.length)) continue
      if (d < bestDist) {
        best = i
        bestDist = d
        tie = false
      } else if (d === bestDist && best !== i) tie = true
    }
  })
  return tie ? -1 : best
}

export const matches = (accept: string[], guess: string, exclusive?: string[]) => findAnswer([accept], guess, exclusive) === 0

/** First letter (for chains), ignoring articles and accents. */
export const firstLetter = (name: string) => normalize(name).charAt(0)
export const lastLetter = (name: string) => normalize(name).slice(-1)
