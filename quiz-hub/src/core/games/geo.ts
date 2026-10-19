import { SIMILAR_FLAGS, asAnswerType, capitalNames, countryDistractors, countryNames, countryPool, initial, pickByDifficulty, wanted } from '../gen.ts'
import { sample, shuffle, withAnswer } from '../rng.ts'
import { normalize } from '../text.ts'
import type { Challenge, Continent, Country, Difficulty, GenContext, McqChallenge } from '../types.ts'

const fmtPop = (m: number) => (m >= 1 ? `${Math.round(m * 10) / 10} millions` : `${Math.round(m * 1000)} 000`).replace('.', ',')

function flagHints(c: Country, ctx: GenContext): string[] | undefined {
  return ctx.config.hints ? [`Continent : ${c.continent}`, `Capitale : ${c.capital}`] : undefined
}

/** Flag → country. */
export function flag(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = content.countries
  const names = all.flatMap(countryNames)
  return pickByDifficulty(countryPool(all), config.difficulty, wanted(config), ctx).map((c) => {
    const wrong = countryDistractors(c, all, config.difficulty, config.difficulty === 1 ? 2 : 3, ctx.rng, SIMILAR_FLAGS)
    const { choices, answer } = withAnswer(c.name, wrong.map((w) => w.name), ctx.rng)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `flag-${c.code}`, d: c.tier, prompt: 'À quel pays appartient ce drapeau ?', media: { type: 'flag', code: c.code },
      choices, answer, hints: flagHints(c, ctx),
      explanation: `${c.name} — capitale : ${c.capital}, ${c.continent}.${c.status === 'observer' ? ' État observateur à l’ONU.' : ''}`,
    }
    return asAnswerType(mcq, countryNames(c), config, names)
  })
}

/** Country name → pick its flag among several. */
export function flagReverse(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = content.countries
  return pickByDifficulty(countryPool(all), config.difficulty, wanted(config), ctx).map((c): Challenge => {
    const wrong = countryDistractors(c, all, Math.max(2, config.difficulty) as Difficulty, config.difficulty === 1 ? 2 : 3, ctx.rng, SIMILAR_FLAGS)
    const options = shuffle([c, ...wrong], ctx.rng)
    return {
      kind: 'mcq', id: `flagr-${c.code}`, d: c.tier, prompt: `Quel est le drapeau de : ${c.name} ?`,
      choices: options.map((o) => o.name), choiceFlags: options.map((o) => o.code), answer: options.indexOf(c),
      hints: config.hints ? [`Continent : ${c.continent}`] : undefined,
      explanation: `${c.name} (${c.continent}).`,
    }
  })
}

const CONTINENTS: Continent[] = ['Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Asie', 'Europe', 'Océanie']

/** Flag → its continent or its capital (alternating). */
export function flagGeo(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = content.countries.filter((c) => !c.disputedCapital)
  return pickByDifficulty(countryPool(all), config.difficulty, wanted(config), ctx).map((c, i): Challenge => {
    if (i % 2 === 0) {
      const wrong = sample(CONTINENTS.filter((x) => x !== c.continent), config.difficulty === 1 ? 2 : 3, ctx.rng)
      const { choices, answer } = withAnswer(c.continent, wrong, ctx.rng)
      return { kind: 'mcq', id: `flagc-${c.code}`, d: c.tier, prompt: 'Sur quel continent se trouve le pays de ce drapeau ?', media: { type: 'flag', code: c.code }, choices, answer, explanation: `C'est le drapeau de ${c.name}.` }
    }
    const wrong = countryDistractors(c, all, config.difficulty, 3, ctx.rng).map((w) => w.capital)
    const mcq: McqChallenge = { kind: 'mcq', id: `flagcap-${c.code}`, d: c.tier, prompt: 'Quelle est la capitale du pays de ce drapeau ?', media: { type: 'flag', code: c.code }, ...withAnswer(c.capital, wrong, ctx.rng), explanation: `${c.name} : ${c.capital}.` }
    return asAnswerType(mcq, capitalNames(c), config, all.flatMap(capitalNames))
  })
}

/** Regions and territories: never presented as sovereign countries. */
export function territories(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = content.territories.map((t) => ({ ...t, id: t.code }))
  const names = all.flatMap((t) => [t.name, ...(t.alt ?? [])])
  return pickByDifficulty(all, config.difficulty, wanted(config), ctx).map((t) => {
    const same = all.filter((o) => o.code !== t.code && (config.difficulty >= 3 ? o.sovereign === t.sovereign || o.continent === t.continent : true))
    const wrong = sample(same.length >= 3 ? same : all.filter((o) => o.code !== t.code), 3, ctx.rng).map((o) => o.name)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `terr-${t.code}`, d: t.d, prompt: 'À quel territoire ou région appartient ce drapeau ?', media: { type: 'flag', code: t.code },
      ...withAnswer(t.name, wrong, ctx.rng),
      hints: config.hints ? [`Rattachement : ${t.sovereign}`, `Statut : ${t.kind}`] : undefined,
      explanation: `${t.name} : ${t.kind}, ${t.sovereign}. Ce n'est pas un État souverain.`,
    }
    return asAnswerType(mcq, [t.name, ...(t.alt ?? [])], config, names)
  })
}

// ---------- Capitals ----------

const capitalCountries = (cs: Country[]) => cs.filter((c) => !c.disputedCapital)

export function capital(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = capitalCountries(content.countries)
  return pickByDifficulty(countryPool(all), config.difficulty, wanted(config), ctx).map((c) => {
    const wrong = countryDistractors(c, all, config.difficulty, config.difficulty === 1 ? 2 : 3, ctx.rng).map((w) => w.capital)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `cap-${c.code}`, d: c.tier, prompt: `Quelle est la capitale de : ${c.name} ?`, media: { type: 'flag', code: c.code },
      ...withAnswer(c.capital, wrong, ctx.rng),
      hints: config.hints ? [`Commence par « ${initial(c.capital)} »`, `${c.capital.length} caractères`] : undefined,
      explanation: c.capitalAlt?.length ? `Également accepté : ${c.capitalAlt.join(', ')}.` : undefined,
    }
    return asAnswerType(mcq, capitalNames(c), config, all.flatMap(capitalNames))
  })
}

export function capitalReverse(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  // Skip countries named like their capital (Luxembourg, Monaco…): nothing to guess.
  const all = capitalCountries(content.countries).filter((c) => normalize(c.capital) !== normalize(c.name))
  return pickByDifficulty(countryPool(all), config.difficulty, wanted(config), ctx).map((c) => {
    const wrong = countryDistractors(c, all, config.difficulty, config.difficulty === 1 ? 2 : 3, ctx.rng).map((w) => w.name)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `capr-${c.code}`, d: c.tier, prompt: `${c.capital} est la capitale de quel pays ?`,
      ...withAnswer(c.name, wrong, ctx.rng),
      hints: config.hints ? [`Continent : ${c.continent}`] : undefined,
    }
    return asAnswerType(mcq, countryNames(c), config, content.countries.flatMap(countryNames))
  })
}

/** Guess the capital from progressive geographic clues. */
export function capitalClue(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = capitalCountries(content.countries)
  return pickByDifficulty(countryPool(all), config.difficulty, wanted(config, 8), ctx).map((c): Challenge => {
    const clues = [
      `C'est une capitale située en ${c.continent}.`,
      `Son pays compte environ ${fmtPop(c.pop)} d'habitants.`,
      `Le nom de son pays commence par « ${initial(c.name)} ».`,
      `Elle s'écrit en ${c.capital.length} caractères et commence par « ${initial(c.capital)} ».`,
      `C'est la capitale de ${c.name}.`,
    ]
    const wrong = countryDistractors(c, all, Math.max(2, config.difficulty) as Difficulty, 3, ctx.rng).map((w) => w.capital)
    return {
      kind: 'text', id: `capc-${c.code}`, d: c.tier, prompt: 'Quelle est cette capitale ?',
      accept: capitalNames(c), display: c.capital, exclusive: all.flatMap(capitalNames),
      clues: config.difficulty === 4 ? clues.slice(0, 4) : clues, attempts: config.difficulty === 4 ? 2 : 4,
      choices: config.answerType === 'text' ? undefined : withAnswer(c.capital, wrong, ctx.rng).choices,
    }
  })
}

/** One long round: capitals chained by last/first letter. */
export function capitalChain(ctx: GenContext): Challenge[] {
  const all = capitalCountries(ctx.content.countries)
  return [{
    kind: 'list', id: 'cap-chain', d: ctx.config.difficulty, chain: true,
    prompt: 'Enchaînez les capitales : chacune doit commencer par la dernière lettre de la précédente.',
    answers: all.map((c) => ({ n: c.capital, alt: c.capitalAlt })),
    exclusive: ctx.content.countries.flatMap(countryNames),
  }]
}

// ---------- Logos ----------

export function logo(ctx: GenContext): Challenge[] {
  const { config, content } = ctx
  const all = content.logos.map((l) => ({ ...l, id: l.slug }))
  const names = all.flatMap((l) => [l.name, ...(l.alt ?? [])])
  const d = config.difficulty
  return pickByDifficulty(all, d, wanted(config), ctx).map((l) => {
    const sameSector = shuffle(all.filter((o) => o.slug !== l.slug && o.sector === l.sector), ctx.rng)
    const others = shuffle(all.filter((o) => o.slug !== l.slug && o.sector !== l.sector), ctx.rng)
    const wrong = (d >= 3 ? [...sameSector, ...others] : d === 2 ? shuffle([...sameSector.slice(0, 1), ...others], ctx.rng) : others).slice(0, d === 1 ? 2 : 3)
    const mcq: McqChallenge = {
      kind: 'mcq', id: `logo-${l.slug}`, d: l.d, prompt: 'Quelle marque se cache derrière ce logo ?',
      media: { type: 'logo', slug: l.slug, mono: d >= 3, crop: d === 4, reveal: config.variant === 'reveal' },
      ...withAnswer(l.name, wrong.map((w) => w.name), ctx.rng),
      hints: config.hints ? [`Secteur : ${SECTORS[l.sector] ?? l.sector}`] : undefined,
    }
    return asAnswerType(mcq, [l.name, ...(l.alt ?? [])], config, names)
  })
}

export const SECTORS: Record<string, string> = {
  tech: 'technologie', social: 'réseaux sociaux et messagerie', media: 'médias et divertissement', sport: 'sport', food: 'alimentation et restauration',
  gaming: 'jeux vidéo', finance: 'finance', auto: 'automobile', energy: 'énergie', travel: 'voyage et transport', dev: 'développement logiciel',
  retail: 'commerce', telecom: 'télécoms', industry: 'industrie',
}
