import { BAND, ENDLESS, asAnswerType, countryNames, capitalNames, initial, pickByDifficulty, pickProgressive, questionToChallenge, themeFilter, wanted } from '../gen.ts'
import { freshFirst, sample, shuffle, withAnswer } from '../rng.ts'
import { normalize } from '../text.ts'
import type { Challenge, Content, Difficulty, GenContext, ListCategory, McqChallenge, RareQuestion } from '../types.ts'

export function classic(ctx: GenContext): Challenge[] {
  const { config } = ctx
  const pool = themeFilter(ctx.content.questions, config)
  const picked = pickByDifficulty(pool, config.difficulty, wanted(config), ctx)
  const ordered = config.shuffle ? picked : [...picked].sort((a, b) => a.d - b.d)
  return ordered.map((q) => questionToChallenge(q, config, ctx))
}

/** Questions of the chosen themes, from easy to hard. */
export function themed(ctx: GenContext): Challenge[] {
  const pool = themeFilter(ctx.content.questions, ctx.config)
  const n = wanted(ctx.config)
  const picked = ctx.config.shuffle ? pickByDifficulty(pool, ctx.config.difficulty, n, ctx) : pickProgressive(pool, n, ctx)
  return picked.map((q) => questionToChallenge(q, ctx.config, ctx))
}

export function truefalse(ctx: GenContext): Challenge[] {
  const pool = themeFilter(ctx.content.truefalse, ctx.config)
  return pickProgressive(pool, wanted(ctx.config, 15), ctx).map(
    (s): McqChallenge => ({ kind: 'mcq', id: s.id, d: s.d, theme: s.t, prompt: s.s, choices: ['Vrai', 'Faux'], answer: s.v ? 0 : 1, explanation: s.x }),
  )
}

export function impossible(ctx: GenContext): Challenge[] {
  const pool = themeFilter(ctx.content.questions, ctx.config)
  return pickByDifficulty(pool, 4, wanted(ctx.config), ctx).map((q) => questionToChallenge(q, { ...ctx.config, difficulty: 4 }, ctx))
}

/** Endless, rising difficulty: used by the survivor and speed games. */
export function rising(ctx: GenContext): Challenge[] {
  const pool = themeFilter(ctx.content.questions, ctx.config)
  return pickProgressive(pool, Math.min(ENDLESS, pool.length), ctx).map((q) => questionToChallenge(q, { ...ctx.config, difficulty: q.d }, ctx))
}

/** 12 levels: 3 per difficulty. */
export function ladder(ctx: GenContext): Challenge[] {
  const pool = themeFilter(ctx.content.questions, ctx.config)
  const out: Challenge[] = []
  for (const d of [1, 2, 3, 4] as Difficulty[]) {
    for (const q of pickByDifficulty(pool.filter((x) => !out.some((o) => o.id === x.id)), d, 3, ctx)) {
      out.push(questionToChallenge(q, { ...ctx.config, difficulty: Math.max(2, d) as Difficulty }, ctx))
    }
  }
  return out
}

export function clues(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const pool = themeFilter(content.clues, config)
  return pickByDifficulty(pool, config.difficulty, wanted(config, 8), ctx).map((item): Challenge => {
    // Expert: only the vaguest clues, fewer tries.
    const list = config.difficulty === 4 ? item.clues.slice(0, 3) : item.clues
    const sameCat = content.clues.filter((c) => c.cat === item.cat && c.id !== item.id).map((c) => c.a)
    const others = content.clues.filter((c) => c.id !== item.id).map((c) => c.a)
    const wrong = sample(sameCat.length >= 3 ? sameCat : others, 3, ctx.rng)
    const { choices } = withAnswer(item.a, wrong, ctx.rng)
    return {
      kind: 'text',
      id: item.id,
      d: item.d,
      theme: item.t,
      prompt: `${item.cat} : qui ou que suis-je ?`,
      accept: [item.a, ...(item.alt ?? [])],
      display: item.a,
      clues: list,
      attempts: config.difficulty === 4 ? 2 : list.length,
      choices: config.answerType === 'text' ? undefined : choices,
      exclusive: content.clues.filter((c) => c.id !== item.id).map((c) => c.a),
      explanation: `Indices : ${item.clues.join(' · ')}`,
    }
  })
}

// ---------- Lists ("Classement des réponses") ----------

/** List categories generated from the country data, in addition to the hand-written ones. */
const OF_CONTINENT: Record<string, string> = {
  Europe: "d'Europe",
  Afrique: "d'Afrique",
  Asie: "d'Asie",
  Océanie: "d'Océanie",
  'Amérique du Sud': "d'Amérique du Sud",
  'Amérique du Nord': "d'Amérique du Nord (Amérique centrale et Caraïbes comprises)",
}

export function generatedLists(content: Content): ListCategory[] {
  const out: ListCategory[] = []
  const conts: [string, Difficulty][] = [['Europe', 1], ['Afrique', 2], ['Amérique du Sud', 1], ['Asie', 2], ['Océanie', 3], ['Amérique du Nord', 3]]
  for (const [cont, d] of conts) {
    const cs = content.countries.filter((c) => c.continent === cont)
    out.push({ id: `lst-pays-${normalize(cont)}`, d, prompt: `Les pays ${OF_CONTINENT[cont]}`, answers: cs.map((c) => ({ n: c.name, alt: c.alt })) })
    out.push({
      id: `lst-cap-${normalize(cont)}`,
      d: Math.min(4, d + 1) as Difficulty,
      prompt: `Les capitales des pays ${OF_CONTINENT[cont]}`,
      answers: cs.filter((c) => !c.disputedCapital).map((c) => ({ n: c.capital, alt: c.capitalAlt })),
    })
  }
  out.push({ id: 'lst-pays-100m', d: 3, prompt: 'Les pays de plus de 100 millions d’habitants', answers: content.countries.filter((c) => c.pop >= 100).map((c) => ({ n: c.name, alt: c.alt })) })
  return out
}

export function listing(ctx: GenContext): Challenge[] {
  const all = [...ctx.content.lists, ...generatedLists(ctx.content)]
  const allNames = ctx.content.countries.flatMap((c) => [...countryNames(c), ...capitalNames(c)])
  return pickByDifficulty(all, ctx.config.difficulty, wanted(ctx.config, 3), ctx).map((l) => ({
    kind: 'list',
    id: l.id,
    d: l.d,
    prompt: l.prompt,
    answers: l.answers,
    exclusive: allNames,
  }))
}

// ---------- Estimation ----------

const TOLERANCE: Record<Difficulty, number> = { 1: 0.6, 2: 0.45, 3: 0.3, 4: 0.2 }

export function closest(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const tol = TOLERANCE[config.difficulty]
  const popQuestions = content.countries
    .filter((c) => c.pop >= 1)
    .map((c) => ({ id: `pop-${c.code}`, d: c.tier, q: `Combien d'habitants compte ${c.name} (en millions) ?`, a: c.pop, unit: 'millions', src: 'ONU, estimations 2023 arrondies', x: undefined as string | undefined }))
  const pool = [...content.estimates, ...popQuestions]
  return pickByDifficulty(pool, config.difficulty, wanted(config, 8), ctx).map((e) => ({
    kind: 'estimate',
    id: e.id,
    d: e.d,
    prompt: e.q,
    answer: e.a,
    unit: e.unit,
    scale: Math.max(Math.abs(e.a) * tol, 1),
    min: 0,
    explanation: e.x,
    source: e.src,
  }))
}

const YEAR_SCALE: Record<Difficulty, number> = { 1: 80, 2: 50, 3: 30, 4: 15 }

export function guessYear(ctx: GenContext): Challenge[] {
  return pickByDifficulty(ctx.content.events, ctx.config.difficulty, wanted(ctx.config, 8), ctx).map((e) => ({
    kind: 'estimate',
    id: e.id,
    d: e.d,
    prompt: `En quelle année ? ${e.label}`,
    answer: e.year,
    unit: '',
    scale: YEAR_SCALE[ctx.config.difficulty],
    explanation: `${e.label} : ${e.year < 0 ? `${-e.year} av. J.-C.` : e.year}.`,
  }))
}

const CHRONO_SIZE: Record<Difficulty, number> = { 1: 3, 2: 4, 3: 5, 4: 6 }
const CHRONO_GAP: Record<Difficulty, number> = { 1: 50, 2: 20, 3: 5, 4: 1 }

export const yearLabel = (y: number) => (y < 0 ? `${-y} av. J.-C.` : String(y))

export function chronology(ctx: GenContext): Challenge[] {
  const { config } = ctx
  const size = CHRONO_SIZE[config.difficulty]
  const gap = CHRONO_GAP[config.difficulty]
  const pool = ctx.content.events.filter((e) => BAND[config.difficulty].includes(e.d) || e.d < config.difficulty)
  const out: Challenge[] = []
  const used = new Set<string>()
  for (let r = 0; r < wanted(config, 5); r++) {
    const chosen: typeof pool = []
    for (const e of freshFirst(pool.filter((x) => !used.has(x.id)), ctx.rng, ctx.recent)) {
      if (chosen.every((c) => Math.abs(c.year - e.year) >= gap)) chosen.push(e)
      if (chosen.length === size) break
    }
    if (chosen.length < 3) break
    chosen.forEach((e) => used.add(e.id))
    const items = shuffle(chosen, ctx.rng)
    out.push({
      kind: 'order',
      id: `chrono-${items.map((e) => e.id).join('-')}`,
      d: config.difficulty,
      prompt: 'Remettez ces événements dans l’ordre chronologique (du plus ancien au plus récent).',
      items: items.map((e) => e.label),
      values: items.map((e) => e.year),
      labels: items.map((e) => yearLabel(e.year)),
      dir: 'asc',
    })
  }
  return out
}

// ---------- Rare answer ----------

/** Rare-answer questions generated from the countries; rarity = editorial country tier. */
export function generatedRare(content: Content): RareQuestion[] {
  const out: RareQuestion[] = []
  const rule = 'Rareté = notoriété éditoriale du pays (niveaux 1 à 4 du référentiel des pays).'
  const byLetter = (countries: Content['countries'], key: (c: Content['countries'][number]) => string) => {
    const m = new Map<string, Content['countries']>()
    for (const c of countries) m.set(initial(key(c)), [...(m.get(initial(key(c))) ?? []), c])
    return m
  }
  for (const [letter, cs] of byLetter(content.countries, (c) => c.name)) {
    if (cs.length >= 5) out.push({ id: `rar-pays-${letter}`, d: 2, prompt: `Cite un pays dont le nom commence par « ${letter} ».`, rule, answers: cs.map((c) => ({ n: c.name, alt: c.alt?.filter((a) => initial(a) === letter), tier: c.tier })) })
  }
  for (const [letter, cs] of byLetter(content.countries.filter((c) => !c.disputedCapital), (c) => c.capital)) {
    if (cs.length >= 4) out.push({ id: `rar-cap-${letter}`, d: 3, prompt: `Cite une capitale commençant par « ${letter} ».`, rule, answers: cs.map((c) => ({ n: c.capital, alt: c.capitalAlt?.filter((a) => initial(a) === letter), tier: c.tier })) })
  }
  for (const cont of ['Europe', 'Afrique', 'Asie', 'Amérique du Sud', 'Océanie'] as const) {
    const cs = content.countries.filter((c) => c.continent === cont)
    out.push({ id: `rar-cont-${normalize(cont)}`, d: cont === 'Océanie' ? 3 : 1, prompt: `Cite un pays situé en ${cont === 'Amérique du Sud' ? 'Amérique du Sud' : cont}.`, rule, answers: cs.map((c) => ({ n: c.name, alt: c.alt, tier: c.tier })) })
  }
  return out
}

export function rare(ctx: GenContext): Challenge[] {
  const all = [...ctx.content.rare, ...generatedRare(ctx.content)]
  const exclusive = ctx.content.countries.flatMap((c) => [...countryNames(c), ...capitalNames(c)])
  return pickByDifficulty(all, ctx.config.difficulty, wanted(ctx.config, 5), ctx).map((r) => ({
    kind: 'rare',
    id: r.id,
    d: r.d,
    prompt: r.prompt,
    rule: r.rule,
    answers: r.answers,
    exclusive,
  }))
}

/** Multiple-choice question about a random trivia question (used by daily / boss). */
export const anyQuestion = (ctx: GenContext, d: Difficulty) =>
  questionToChallenge(pickByDifficulty(ctx.content.questions, d, 1, ctx)[0], { ...ctx.config, difficulty: d, answerType: 'qcm' }, ctx)

export { asAnswerType }
