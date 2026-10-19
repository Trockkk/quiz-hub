import { ENDLESS, asAnswerType, pickByDifficulty, wanted } from '../gen.ts'
import { freshFirst, pick, shuffle, withAnswer } from '../rng.ts'
import { normalize } from '../text.ts'
import type { Challenge, Content, Difficulty, GenContext, McqChallenge, TextChallenge } from '../types.ts'

const int = (rng: () => number, a: number, b: number) => a + Math.floor(rng() * (b - a + 1))
const fmt = (n: number) => n.toLocaleString('fr-FR')

// ---------- Connections ----------

const MISTAKES: Record<Difficulty, number> = { 1: 6, 2: 4, 3: 3, 4: 2 }

export function connections(ctx: GenContext): Challenge[] {
  return pickByDifficulty(ctx.content.connections, ctx.config.difficulty, wanted(ctx.config, 3), ctx).map((p) => ({
    kind: 'connections',
    id: p.id,
    d: p.d,
    prompt: 'Formez des groupes de 4 éléments qui ont un point commun.',
    groups: p.groups,
    items: shuffle(p.groups.flatMap((g) => g.items), ctx.rng),
    mistakes: MISTAKES[ctx.config.difficulty],
  }))
}

// ---------- Odd one out ----------

export function odd(ctx: GenContext): Challenge[] {
  return pickByDifficulty(ctx.content.odd, ctx.config.difficulty, wanted(ctx.config), ctx).map((o): McqChallenge => {
    const order = shuffle(o.items.map((_, i) => i), ctx.rng)
    return { kind: 'mcq', id: o.id, d: o.d, prompt: 'Trouvez l’intrus.', choices: order.map((i) => o.items[i]), answer: order.indexOf(o.odd), explanation: o.x }
  })
}

// ---------- Logical sequences (generated: infinite and always correct) ----------

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

interface Seq {
  terms: (number | string)[]
  next: number | string
  rule: string
}

export function makeSequence(d: Difficulty, rng: () => number): Seq {
  const kinds: Record<Difficulty, string[]> = {
    1: ['add', 'sub', 'letters'],
    2: ['mul', 'alt', 'squares', 'letters'],
    3: ['fib', 'incdiff', 'interleave', 'cubes'],
    4: ['primes', 'triangular', 'doubleplus', 'diffdouble', 'lettersq'],
  }
  const kind = pick(kinds[d], rng)
  const arith = (a: number, k: number, n: number) => Array.from({ length: n }, (_, i) => a + i * k)
  switch (kind) {
    case 'add': {
      const a = int(rng, 1, 20), k = int(rng, 2, 9)
      return { terms: arith(a, k, 5), next: a + 5 * k, rule: `On ajoute ${k} à chaque terme.` }
    }
    case 'sub': {
      const k = int(rng, 2, 9), a = int(rng, 6 * k, 6 * k + 40)
      return { terms: arith(a, -k, 5), next: a - 5 * k, rule: `On retire ${k} à chaque terme.` }
    }
    case 'letters': {
      const k = int(rng, 2, d === 1 ? 2 : 4), s = int(rng, 0, 25 - 5 * k)
      return { terms: [0, 1, 2, 3].map((i) => LETTERS[s + i * k]), next: LETTERS[s + 4 * k], rule: `On avance de ${k} lettres dans l'alphabet.` }
    }
    case 'mul': {
      const a = int(rng, 1, 4), k = int(rng, 2, 3)
      return { terms: [0, 1, 2, 3, 4].map((i) => a * k ** i), next: a * k ** 5, rule: `On multiplie par ${k}.` }
    }
    case 'alt': {
      const p = int(rng, 4, 9), m = int(rng, 1, p - 1), a = int(rng, 5, 20)
      const terms = [a]
      for (let i = 1; i < 6; i++) terms.push(terms[i - 1] + (i % 2 ? p : -m))
      return { terms, next: terms[5] + p, rule: `On ajoute ${p}, puis on retire ${m}, en alternance.` }
    }
    case 'squares': {
      const s = int(rng, 1, 6)
      return { terms: [0, 1, 2, 3, 4].map((i) => (s + i) ** 2), next: (s + 5) ** 2, rule: 'Ce sont des carrés successifs.' }
    }
    case 'fib': {
      const terms = [int(rng, 1, 5), int(rng, 1, 6)]
      while (terms.length < 6) terms.push(terms.at(-1)! + terms.at(-2)!)
      return { terms, next: terms[4] + terms[5], rule: 'Chaque terme est la somme des deux précédents.' }
    }
    case 'incdiff': {
      const a = int(rng, 1, 10), d0 = int(rng, 1, 4)
      const terms = [a]
      for (let i = 0; i < 5; i++) terms.push(terms[i] + d0 + i)
      return { terms, next: terms[5] + d0 + 5, rule: `L'écart augmente de 1 à chaque fois (+${d0}, +${d0 + 1}, …).` }
    }
    case 'interleave': {
      const a = int(rng, 1, 9), p = int(rng, 2, 5), b = int(rng, 20, 40), q = int(rng, 2, 5)
      const terms = [a, b, a + p, b - q, a + 2 * p, b - 2 * q]
      return { terms, next: a + 3 * p, rule: `Deux suites entrelacées : +${p} pour l'une, −${q} pour l'autre.` }
    }
    case 'cubes': {
      const s = int(rng, 1, 3)
      return { terms: [0, 1, 2, 3].map((i) => (s + i) ** 3), next: (s + 4) ** 3, rule: 'Ce sont des cubes successifs.' }
    }
    case 'primes': {
      const s = int(rng, 1, 8)
      return { terms: PRIMES.slice(s, s + 5), next: PRIMES[s + 5], rule: 'Ce sont des nombres premiers consécutifs.' }
    }
    case 'triangular': {
      const s = int(rng, 1, 5), t = (n: number) => (n * (n + 1)) / 2
      return { terms: [0, 1, 2, 3, 4].map((i) => t(s + i)), next: t(s + 5), rule: 'Nombres triangulaires : l’écart augmente de 1 (n(n+1)/2).' }
    }
    case 'doubleplus': {
      const terms = [int(rng, 1, 5)]
      while (terms.length < 5) terms.push(terms.at(-1)! * 2 + 1)
      return { terms, next: terms[4] * 2 + 1, rule: 'On multiplie par 2 puis on ajoute 1.' }
    }
    case 'diffdouble': {
      const a = int(rng, 1, 10), d0 = int(rng, 1, 3)
      const terms = [a]
      for (let i = 0; i < 4; i++) terms.push(terms[i] + d0 * 2 ** i)
      return { terms, next: terms[4] + d0 * 16, rule: `L'écart double à chaque fois (+${d0}, +${d0 * 2}, +${d0 * 4}, …).` }
    }
    default: {
      // lettersq: letters at square positions A(1) D(4) I(9) P(16) Y(25)
      return { terms: ['A', 'D', 'I', 'P'], next: 'Y', rule: 'Les positions dans l’alphabet sont des carrés : 1, 4, 9, 16, 25.' }
    }
  }
}

function seqDistractors(s: Seq, rng: () => number): string[] {
  const out = new Set<string>()
  if (typeof s.next === 'string') {
    const i = LETTERS.indexOf(s.next)
    for (const o of shuffle([-2, -1, 1, 2, 3], rng)) if (LETTERS[i + o]) out.add(LETTERS[i + o])
  } else {
    const n = s.next
    const last = s.terms.at(-1) as number
    const prev = s.terms.at(-2) as number
    for (const c of shuffle([n + 1, n - 1, n + 2, n - 2, last + (last - prev), n + (last - prev), Math.round(n * 1.1), n + 10], rng)) {
      if (c !== n && c > 0) out.add(String(c))
    }
  }
  return [...out].filter((x) => x !== String(s.next)).slice(0, 3)
}

export function sequence(ctx: GenContext): Challenge[] {
  const { config } = ctx
  return Array.from({ length: wanted(config) }, (_, i): Challenge => {
    const s = makeSequence(config.difficulty, ctx.rng)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `seq-${i}-${s.terms.join('.')}`, d: config.difficulty,
      prompt: `Quel est l'élément suivant ?  ${s.terms.join(' · ')} · ?`,
      ...withAnswer(String(s.next), seqDistractors(s, ctx.rng), ctx.rng),
      explanation: s.rule,
    }
    const t = asAnswerType(mcq, [String(s.next)], config)
    return t.kind === 'text' ? { ...t, numeric: typeof s.next === 'number', hints: undefined } : t
  })
}

// ---------- Rankings and higher / lower (sourced values) ----------

interface FactSet {
  id: string
  prop: string
  unit: string
  src: string
  /** question for "higher or lower" */
  which: string
  /** minimum ratio between compared values: protects against rounding in the data */
  minRatio: number
  items: { n: string; v: number; d: Difficulty }[]
}

const WHICH: Record<string, string> = {
  'rk-planet-dist': 'Quelle planète est la plus éloignée du Soleil ?',
  'rk-planet-size': 'Quelle planète est la plus grande ?',
  'rk-mountains': 'Quel sommet est le plus haut ?',
  'rk-rivers': 'Quel fleuve est le plus long ?',
  'rk-buildings': 'Quelle construction est la plus haute ?',
}

export function factSets(content: Content): FactSet[] {
  const cs = content.countries.filter((c) => c.status !== 'observer')
  return [
    { id: 'pop', prop: 'population', unit: "millions d'habitants", src: 'ONU, estimations 2023 arrondies', which: 'Quel pays compte le plus d’habitants ?', minRatio: 1.15, items: cs.map((c) => ({ n: c.name, v: c.pop, d: c.tier })) },
    { id: 'area', prop: 'superficie', unit: 'km²', src: 'CIA World Factbook, arrondi', which: 'Quel pays est le plus vaste ?', minRatio: 1.1, items: cs.map((c) => ({ n: c.name, v: c.area, d: c.tier })) },
    ...content.rankings.map((r) => ({ id: r.id, prop: r.prop, unit: r.unit, src: r.src, which: WHICH[r.id] ?? `Lequel a la plus grande valeur (${r.prop}) ?`, minRatio: 1.03, items: r.items.map((i) => ({ ...i, d: 2 as Difficulty })) })),
  ]
}

const RANK_SIZE: Record<Difficulty, number> = { 1: 3, 2: 4, 3: 5, 4: 6 }
const RANK_RATIO: Record<Difficulty, number> = { 1: 1.8, 2: 1.4, 3: 1.15, 4: 1.05 }

/** Picks items whose values are all far enough apart. */
function spread(items: FactSet['items'], n: number, ratio: number, rng: () => number) {
  const chosen: FactSet['items'] = []
  for (const it of shuffle(items, rng)) {
    if (chosen.every((c) => Math.max(c.v, it.v) / Math.min(c.v, it.v) >= ratio)) chosen.push(it)
    if (chosen.length === n) break
  }
  return chosen
}

const tierFit = (items: FactSet['items'], d: Difficulty) => items.filter((i) => i.d <= Math.max(d, 2))

export function ranking(ctx: GenContext): Challenge[] {
  const { config } = ctx
  const sets = factSets(ctx.content)
  const out: Challenge[] = []
  for (let r = 0; r < wanted(config, 5); r++) {
    const set = sets[(r + int(ctx.rng, 0, sets.length - 1)) % sets.length]
    const items = spread(tierFit(set.items, config.difficulty), RANK_SIZE[config.difficulty], Math.max(set.minRatio, RANK_RATIO[config.difficulty]), ctx.rng)
    if (items.length < 3) continue
    const dir = ctx.rng() < 0.5 ? 'asc' : 'desc'
    out.push({
      kind: 'order', id: `rank-${set.id}-${r}`, d: config.difficulty,
      prompt: `Classez du ${dir === 'asc' ? 'plus petit au plus grand' : 'plus grand au plus petit'} selon : ${set.prop}.`,
      items: items.map((i) => i.n), values: items.map((i) => i.v), labels: items.map((i) => `${fmt(i.v)} ${set.unit}`), dir,
      source: set.src,
    })
  }
  return out
}

const HL_RATIO: Record<Difficulty, number> = { 1: 3, 2: 1.8, 3: 1.35, 4: 1.15 }

export function higherLower(ctx: GenContext): Challenge[] {
  const { config } = ctx
  const sets = factSets(ctx.content)
  const n = config.count > 0 ? config.count : ENDLESS
  const out: Challenge[] = []
  for (let r = 0; out.length < n && r < n * 3; r++) {
    const set = pick(sets, ctx.rng)
    const [a, b] = spread(tierFit(set.items, config.difficulty), 2, Math.max(set.minRatio, HL_RATIO[config.difficulty]), ctx.rng)
    if (!b) continue
    const winner = a.v > b.v ? a : b
    out.push({
      kind: 'mcq', id: `hl-${set.id}-${r}`, d: config.difficulty, prompt: set.which,
      choices: [a.n, b.n], answer: [a, b].indexOf(winner),
      explanation: `${a.n} : ${fmt(a.v)} ${set.unit} · ${b.n} : ${fmt(b.v)} ${set.unit}.`, source: set.src,
    })
  }
  return out
}

// ---------- Detective ----------

export function detective(ctx: GenContext): Challenge[] {
  return pickByDifficulty(ctx.content.cases, ctx.config.difficulty, wanted(ctx.config, 3), ctx).map((c): McqChallenge => {
    const order = shuffle(c.choices.map((_, i) => i), ctx.rng)
    return {
      kind: 'mcq', id: c.id, d: c.d, prompt: c.q, media: { type: 'story', title: c.title, text: c.story, clues: c.clues },
      choices: order.map((i) => c.choices[i]), answer: order.indexOf(c.a), explanation: c.x,
    }
  })
}

// ---------- Words ----------

const wordItems = (content: Content) => content.words.map((w) => ({ ...w, id: `w-${normalize(w.w)}` }))

export function mysteryWord(ctx: GenContext): Challenge[] {
  const { config } = ctx
  const tries = config.variant === 'unlimited' ? 99 : 6
  return pickByDifficulty(wordItems(ctx.content), config.difficulty, wanted(config, 5), ctx).map((w): TextChallenge => ({
    kind: 'text', id: w.id, d: w.d, prompt: `Mot mystère de ${normalize(w.w).length} lettres`,
    accept: [w.w], display: w.w, clues: w.clues, attempts: tries,
    hints: config.hints ? [`Commence par « ${normalize(w.w)[0].toUpperCase()} »`, `Finit par « ${normalize(w.w).at(-1)!.toUpperCase()} »`] : undefined,
  }))
}

export function anagram(ctx: GenContext): Challenge[] {
  const { config } = ctx
  return pickByDifficulty(wordItems(ctx.content), config.difficulty, wanted(config), ctx).map((w): TextChallenge => {
    const letters = normalize(w.w).toUpperCase().split('')
    let mixed = shuffle(letters, ctx.rng).join('')
    for (let i = 0; mixed === letters.join('') && i < 5; i++) mixed = shuffle(letters, ctx.rng).join('')
    return {
      kind: 'text', id: `ana-${w.id}`, d: w.d, prompt: 'Retrouvez le mot dont les lettres ont été mélangées.',
      media: { type: 'letters', letters: mixed }, accept: [w.w], display: w.w,
      hints: config.hints ? [w.clues.at(-1)!, `Commence par « ${letters[0]} »`] : undefined,
    }
  })
}

// ---------- Mental arithmetic ----------

function operation(d: Difficulty, rng: () => number): { q: string; a: number } {
  const r = rng()
  if (d === 1) {
    const a = int(rng, 2, 20), b = int(rng, 2, 20)
    return r < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${Math.max(a, b)} − ${Math.min(a, b)}`, a: Math.abs(a - b) }
  }
  if (d === 2) {
    const a = int(rng, 2, 10), b = int(rng, 2, 10)
    if (r < 0.5) return { q: `${a} × ${b}`, a: a * b }
    const x = int(rng, 11, 99), y = int(rng, 11, 99)
    return { q: `${x} + ${y}`, a: x + y }
  }
  if (d === 3) {
    if (r < 0.35) { const a = int(rng, 11, 25), b = int(rng, 3, 9); return { q: `${a} × ${b}`, a: a * b } }
    if (r < 0.7) { const b = int(rng, 3, 9), q = int(rng, 3, 15); return { q: `${b * q} ÷ ${b}`, a: q } }
    const a = int(rng, 50, 150), b = int(rng, 12, 49)
    return { q: `${a} − ${b}`, a: a - b }
  }
  if (r < 0.33) { const a = int(rng, 11, 25); return { q: `${a}²`, a: a * a } }
  if (r < 0.66) { const p = pick([10, 20, 25, 50, 75], rng), n = 20 * int(rng, 2, 20); return { q: `${p} % de ${n}`, a: (p * n) / 100 } }
  const a = int(rng, 2, 12), b = int(rng, 2, 12), c = int(rng, 3, 9)
  return { q: `(${a} + ${b}) × ${c}`, a: (a + b) * c }
}

export function mentalMath(ctx: GenContext): Challenge[] {
  const n = ctx.config.count > 0 ? ctx.config.count : ENDLESS
  return Array.from({ length: n }, (_, i): Challenge => {
    const { q, a } = operation(ctx.config.difficulty, ctx.rng)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `calc-${i}`, d: ctx.config.difficulty, prompt: `${q} = ?`,
      ...withAnswer(String(a), shuffle([a + 1, a - 1, a + 10, a - 10, a + 2], ctx.rng).filter((x) => x >= 0 && x !== a).slice(0, 3).map(String), ctx.rng),
    }
    const t = asAnswerType(mcq, [String(a)], ctx.config)
    return t.kind === 'text' ? { ...t, numeric: true, hints: undefined } : t
  })
}

export { freshFirst }
