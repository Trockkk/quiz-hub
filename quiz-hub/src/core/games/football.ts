// Football games: all built from src/content/footballers.json (Wikidata: clubs and national teams with years).
import { BAND, pickByDifficulty, wanted } from '../gen.ts'
import { sample, shuffle, withAnswer } from '../rng.ts'
import { levenshtein, normalize, tolerance } from '../text.ts'
import type { Challenge, Content, Footballer, GenContext, McqChallenge, NamedAnswer } from '../types.ts'

const surname = (n: string) => (n.includes(' ') ? n.split(' ').at(-1)! : '')

/** Accepted names inside one list: full name, alternatives, and the surname when no one else in the list shares it. */
export function footballerAnswers(players: Footballer[]): NamedAnswer[] {
  const count = new Map<string, number>()
  for (const p of players) count.set(normalize(surname(p.n)), (count.get(normalize(surname(p.n))) ?? 0) + 1)
  return players.map((p) => ({ n: p.n, alt: [...(p.alt ?? []), ...(surname(p.n) && count.get(normalize(surname(p.n))) === 1 ? [surname(p.n)] : [])] }))
}

/** Where two footballers played together ("FC Barcelone (2013-2017)"), or null. Spans are in calendar years and must overlap. */
export function teammates(a: Footballer, b: Footballer): string | null {
  for (const [list, label] of [['c', ''], ['sel', 'sélection ']] as const) {
    for (const [team, from, to] of a[list]) {
      for (const [team2, from2, to2] of b[list]) {
        if (team === team2 && Math.max(from, from2) < Math.min(to, to2)) return `${label}${team} (${Math.max(from, from2)}-${Math.min(to, to2)})`
      }
    }
  }
  return null
}

interface NameIndex {
  byKey: Map<string, number[]>
  /** fuzzy search: keys grouped by first letter */
  byLetter: Map<string, string[]>
  byId: Map<number, Footballer>
}

const indexes = new WeakMap<Footballer[], NameIndex>()

function nameIndex(players: Footballer[]): NameIndex {
  let idx = indexes.get(players)
  if (idx) return idx
  idx = { byKey: new Map(), byLetter: new Map(), byId: new Map() }
  players.forEach((p, i) => {
    idx!.byId.set(p.id, p)
    for (const name of new Set([p.n, ...(p.alt ?? []), surname(p.n)].filter(Boolean).map(normalize))) {
      const list = idx!.byKey.get(name)
      if (list) list.push(i)
      else {
        idx!.byKey.set(name, [i])
        const bucket = idx!.byLetter.get(name[0])
        if (bucket) bucket.push(name)
        else idx!.byLetter.set(name[0], [name])
      }
    }
  })
  indexes.set(players, idx)
  return idx
}

export const footballerById = (content: Content, id: number) => nameIndex(content.footballers).byId.get(id)

/** Every footballer a typed name may designate, most famous first (the base is sorted by fame). Small typos are tolerated. */
export function findFootballers(content: Content, guess: string): Footballer[] {
  const idx = nameIndex(content.footballers)
  const g = normalize(guess)
  if (!g) return []
  let hits = idx.byKey.get(g)
  if (!hits) {
    let best = Infinity
    for (const key of idx.byLetter.get(g[0]) ?? []) {
      const tol = tolerance(key.length)
      if (Math.abs(key.length - g.length) > tol) continue
      const dist = levenshtein(g, key)
      if (dist > tol || dist > best) continue
      if (dist < best) hits = []
      best = dist
      hits = [...(hits ?? []), ...idx.byKey.get(key)!]
    }
  }
  return [...new Set(hits ?? [])].sort((a, b) => a - b).map((i) => content.footballers[i])
}

const withIds = (players: Footballer[]) => players.map((p) => ({ id: String(p.id), d: p.d, p }))
const inBand = (ctx: GenContext) => ctx.content.footballers.filter((p) => BAND[ctx.config.difficulty].includes(p.d))

/** Teammate chain (multiplayer): one run per round, starting from a footballer of the chosen fame. */
export function chain(ctx: GenContext): Challenge[] {
  const band = inBand(ctx)
  return sample(band.length ? band : ctx.content.footballers, wanted(ctx.config, 1), ctx.rng).map((p) => ({
    kind: 'list',
    id: `foot-chain-${p.id}`,
    d: ctx.config.difficulty,
    prompt: `Départ : ${p.n}. Chacun son tour, citez un joueur qui a joué avec le dernier cité.`,
    // Names are checked against the whole base (room.ts): only the starting player is stored here.
    answers: footballerAnswers([p]),
    start: p.id,
  }))
}

/** Football quiz: club, national team, or teammate of a footballer. Wrong choices come from players of the same fame. */
export function quiz(ctx: GenContext): Challenge[] {
  const { rng } = ctx
  // Some players only have a national team on Wikidata: no club question possible.
  const band = inBand(ctx).filter((p) => p.c.length)
  const clubs = [...new Set(band.flatMap((p) => p.c.map((s) => s[0])))]
  const nations = [...new Set(band.flatMap((p) => p.sel.map((s) => s[0])))]
  return pickByDifficulty(withIds(band), ctx.config.difficulty, wanted(ctx.config, 10), ctx).map(({ id, d, p }, i): McqChallenge => {
    const own = new Set(p.c.map((s) => s[0]))
    const mates = band.filter((o) => o !== p && teammates(p, o))
    const kind = mates.length && i % 3 === 2 ? 'mate' : p.sel.length && i % 3 === 1 ? 'nation' : 'club'
    if (kind === 'mate') {
      const mate = mates[Math.floor(rng() * mates.length)]
      const seen = new Set([normalize(mate.n), normalize(p.n)])
      const others = shuffle(band, rng).filter((o) => !teammates(p, o) && !seen.has(normalize(o.n)) && seen.add(normalize(o.n))).slice(0, 3).map((o) => o.n)
      return { kind: 'mcq', id: `foot-mate-${id}`, d, prompt: `Lequel de ces joueurs a déjà joué avec ${p.n} ?`, ...withAnswer(mate.n, others, rng), explanation: `${mate.n} et ${p.n} : ${teammates(p, mate)}.` }
    }
    if (kind === 'nation') {
      const own = new Set(p.sel.map((s) => s[0]))
      const nation = p.sel[0][0]
      return { kind: 'mcq', id: `foot-nat-${id}`, d, prompt: `Pour quelle sélection ${p.n} a-t-il joué ?`, ...withAnswer(nation, sample(nations.filter((n) => !own.has(n)), 3, rng), rng) }
    }
    const club = p.c[Math.floor(rng() * p.c.length)][0]
    return {
      kind: 'mcq', id: `foot-club-${id}`, d, prompt: `Dans quel club ${p.n} a-t-il joué ?`, ...withAnswer(club, sample(clubs.filter((c) => !own.has(c)), 3, rng), rng),
      explanation: `Ses clubs : ${[...own].join(', ')}.`,
    }
  }).filter((ch) => ch.choices.length === 4)
}

/** "Name the squad": every player of the base who played for a club or national team. */
export function squads(ctx: GenContext): Challenge[] {
  const groups = new Map<string, Footballer[]>()
  for (const p of ctx.content.footballers) {
    for (const team of new Set([...p.c.map((s) => s[0]), ...p.sel.map((s) => `sélection ${s[0]}`)])) groups.set(team, [...(groups.get(team) ?? []), p])
  }
  // A team is as easy as its stars are many.
  const lists = [...groups].filter(([, ps]) => ps.length >= 8).map(([team, ps]) => {
    const stars = ps.filter((p) => p.d <= 2).length
    return { id: `foot-squad-${normalize(team)}`, d: (stars >= 40 ? 1 : stars >= 15 ? 2 : stars >= 5 ? 3 : 4) as 1 | 2 | 3 | 4, team, players: ps }
  })
  return pickByDifficulty(lists, ctx.config.difficulty, wanted(ctx.config, 3), ctx).map((l) => ({
    kind: 'list', id: l.id, d: l.d, prompt: `Citez des joueurs passés par : ${l.team}`, answers: footballerAnswers(l.players),
  }))
}
