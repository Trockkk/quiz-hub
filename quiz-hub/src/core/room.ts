// Authoritative multiplayer room logic. Pure (time and randomness are passed in) so it can be unit-tested;
// the Cloudflare Durable Object in server/ only stores it and relays messages.
import { configFor, getGame, rulesFor } from './catalog.ts'
import {
  COUNTDOWN_MS, GRACE_MS, MAX_PLAYERS, MULTI_KINDS, REVEAL_MS, TURN_MS, cleanName, revealOf, toPublic, validResponse,
  type ClientMessage, type PlayerFinal, type PlayerRoundResult, type PublicRoom, type ServerMessage,
} from './protocol.ts'
import { seeded } from './rng.ts'
import { DIFF_MULT, LIST_POINTS, grade, scoreAnswer } from './scoring.ts'
import { findAnswer, firstLetter, lastLetter } from './text.ts'
import type { Challenge, Config, Content, Response } from './types.ts'

export interface PlayerState {
  id: string
  tokenHash: string
  name: string
  connected: boolean
  joinedAt: number
  score: number
  correct: number
  answered: number
  timeMs: number
  streak: number
  bestStreak: number
  /** list games: canonical answers found this round */
  found: string[]
  alive: boolean
}

export interface RoomData {
  code: string
  createdAt: number
  lastActivity: number
  hostId: string | null
  players: PlayerState[]
  nextPlayerNo: number
  phase: PublicRoom['phase']
  gameId: string
  config: Config
  challenges: Challenge[]
  index: number
  questionStart: number
  deadline: number | null
  answers: Record<string, { response: Response; at: number }>
  turn: { order: string[]; pos: number; deadline: number; used: string[] } | null
  reveal: PublicRoom['reveal']
  final: PlayerFinal[] | null
}

export type Outgoing = { to: string; msg: ServerMessage }

const DEFAULT_GAME = 'classic'

/** Multiplayer constraints on settings: always a timer for lists, no propositions-for-half-points, at most 20 rounds. */
export function multiConfig(gameId: string, partial: Partial<Config> = {}): Config {
  const game = getGame(gameId)!
  const c = configFor(game, partial)
  c.hints = false
  c.explanations = true
  if (c.answerType === 'mixed') c.answerType = 'text'
  if (c.count === 0 || c.count > 20) c.count = 10
  if (c.questionTime === null && (gameId === 'listing' || gameId === 'duel-categories')) c.questionTime = 60
  return c
}

export function createRoom(code: string, now: number): RoomData {
  return {
    code, createdAt: now, lastActivity: now, hostId: null, players: [], nextPlayerNo: 1, phase: 'lobby',
    gameId: DEFAULT_GAME, config: multiConfig(DEFAULT_GAME), challenges: [], index: 0, questionStart: 0, deadline: null,
    answers: {}, turn: null, reveal: null, final: null,
  }
}

const err = (to: string, msg: string): Outgoing => ({ to, msg: { t: 'error', msg } })
const ack = (to: string, ok: boolean, msg: string, found?: string[]): Outgoing => ({ to, msg: { t: 'ack', ok, msg, found } })

export class Room {
  data: RoomData
  private content: Content

  constructor(data: RoomData, content: Content) {
    this.data = data
    this.content = content
  }

  private get ch(): Challenge | undefined {
    return this.data.challenges[this.data.index]
  }

  private get turnMode() {
    return this.data.gameId === 'duel-categories' && this.data.config.variant === 'last'
  }

  player(id: string) {
    return this.data.players.find((p) => p.id === id)
  }

  private connected() {
    return this.data.players.filter((p) => p.connected)
  }

  private electHost() {
    const host = this.player(this.data.hostId ?? '')
    if (host?.connected) return
    this.data.hostId = [...this.connected()].sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? host?.id ?? null
  }

  /** A socket identified by a secret token joins (or rejoins) the room. */
  join(tokenHash: string, rawName: string, now: number): { id: string } | { error: string } {
    this.data.lastActivity = now
    const existing = this.data.players.find((p) => p.tokenHash === tokenHash)
    if (existing) {
      existing.connected = true
      existing.name = this.uniqueName(cleanName(rawName, existing.name), existing.id)
      this.electHost()
      return { id: existing.id }
    }
    if (this.data.players.length >= MAX_PLAYERS) return { error: `Salon complet (${MAX_PLAYERS} joueurs maximum).` }
    const no = this.data.nextPlayerNo++
    const id = `p${no}`
    this.data.players.push({
      id, tokenHash, name: this.uniqueName(cleanName(rawName, `Joueur ${no}`), id), connected: true, joinedAt: now,
      score: 0, correct: 0, answered: 0, timeMs: 0, streak: 0, bestStreak: 0, found: [],
      // Joining during a "last one standing" round: wait for the next round.
      alive: !(this.data.phase === 'question' && this.turnMode),
    })
    this.electHost()
    return { id }
  }

  private uniqueName(name: string, self: string) {
    let n = name
    for (let i = 2; this.data.players.some((p) => p.id !== self && p.name.toLowerCase() === n.toLowerCase()); i++) n = `${name} ${i}`
    return n
  }

  disconnect(id: string, now: number) {
    const p = this.player(id)
    if (!p) return
    p.connected = false
    this.electHost()
    this.afterPresenceChange(now)
  }

  leave(id: string, now: number) {
    this.data.players = this.data.players.filter((p) => p.id !== id)
    delete this.data.answers[id]
    if (this.data.hostId === id) this.data.hostId = null
    this.electHost()
    this.afterPresenceChange(now)
  }

  private afterPresenceChange(now: number) {
    if (this.data.phase !== 'question') return
    if (this.turnMode && this.data.turn) {
      const current = this.player(this.data.turn.order[this.data.turn.pos])
      if (!current?.connected) this.eliminateCurrent(now)
    } else if (this.allAnswered()) this.closeQuestion(now)
  }

  private allAnswered() {
    const ch = this.ch
    if (!ch || ch.kind === 'list') return false
    const active = this.connected()
    return active.length > 0 && active.every((p) => this.data.answers[p.id])
  }

  handle(id: string, msg: ClientMessage, now: number, seed: number): Outgoing[] {
    const d = this.data
    const p = this.player(id)
    if (!p) return [err(id, 'Vous ne faites plus partie de ce salon.')]
    d.lastActivity = now
    const isHost = d.hostId === id
    switch (msg.t) {
      case 'ping':
        return [{ to: id, msg: { t: 'pong' } }]
      case 'config': {
        if (!isHost) return [err(id, 'Seul l’hôte peut choisir le jeu.')]
        if (d.phase !== 'lobby') return [err(id, 'La partie a déjà commencé.')]
        const game = getGame(msg.gameId)
        if (!game || !game.modes.includes('multi')) return [err(id, 'Ce jeu n’est pas disponible en multijoueur.')]
        // Only the changed settings are sent: merged with the current ones (several quick clicks never undo each other).
        const patch = typeof msg.config === 'object' && msg.config ? msg.config : {}
        d.config = multiConfig(game.id, game.id === d.gameId ? { ...d.config, ...patch } : patch)
        d.gameId = game.id
        return []
      }
      case 'start': {
        if (!isHost) return [err(id, 'Seul l’hôte peut lancer la partie.')]
        if (d.phase !== 'lobby') return []
        const game = getGame(d.gameId)!
        const challenges = game.generate!({ content: this.content, config: d.config, rng: seeded(seed) })
          .filter((c) => (MULTI_KINDS as readonly string[]).includes(c.kind))
          .slice(0, d.config.count || 10)
        if (!challenges.length) return [err(id, 'Impossible de générer une partie avec ces paramètres.')]
        d.challenges = challenges
        for (const pl of d.players) Object.assign(pl, { score: 0, correct: 0, answered: 0, timeMs: 0, streak: 0, bestStreak: 0, found: [], alive: true })
        d.final = null
        d.reveal = null
        d.phase = 'countdown'
        d.deadline = now + COUNTDOWN_MS
        return []
      }
      case 'answer': {
        const ch = this.ch
        if (d.phase !== 'question' || !ch || msg.index !== d.index || ch.kind === 'list') return []
        if (d.answers[id]) return [ack(id, false, 'Réponse déjà enregistrée.')]
        if (d.deadline !== null && now > d.deadline + GRACE_MS) return [ack(id, false, 'Trop tard !')]
        if (!validResponse(ch, msg.response)) return [ack(id, false, 'Réponse invalide.')]
        d.answers[id] = { response: msg.response, at: now }
        if (this.allAnswered()) this.closeQuestion(now)
        return [ack(id, true, 'Réponse enregistrée.')]
      }
      case 'guess':
        return this.guess(p, msg, now)
      case 'skip':
        if (isHost && d.phase === 'question') this.closeQuestion(now)
        return []
      case 'replay':
        if (!isHost) return [err(id, 'Seul l’hôte peut relancer.')]
        if (d.phase === 'results' || d.phase === 'lobby') {
          d.phase = 'lobby'
          d.challenges = []
          d.final = null
          d.reveal = null
          d.deadline = null
        }
        return []
      case 'leave':
        this.leave(id, now)
        return []
      default:
        return [err(id, 'Message inconnu.')]
    }
  }

  private guess(p: PlayerState, msg: Extract<ClientMessage, { t: 'guess' }>, now: number): Outgoing[] {
    const d = this.data
    const ch = this.ch
    if (d.phase !== 'question' || !ch || ch.kind !== 'list' || msg.index !== d.index || typeof msg.text !== 'string' || msg.text.length > 100) return []
    const i = findAnswer(ch.answers.map((a) => [a.n, ...(a.alt ?? [])]), msg.text, ch.exclusive)
    if (this.turnMode) {
      const t = d.turn
      if (!t || t.order[t.pos] !== p.id) return [ack(p.id, false, 'Ce n’est pas votre tour.')]
      if (i < 0) return [ack(p.id, false, `« ${msg.text} » n’est pas valide.`)]
      const name = ch.answers[i].n
      if (t.used.includes(name)) return [ack(p.id, false, `${name} a déjà été cité.`)]
      t.used.push(name)
      p.found.push(name)
      this.advanceTurn(now)
      return [ack(p.id, true, `✓ ${name}`, p.found)]
    }
    if (d.deadline !== null && now > d.deadline + GRACE_MS) return [ack(p.id, false, 'Trop tard !')]
    if (i < 0) return [ack(p.id, false, `« ${msg.text} » n’est pas valide.`, p.found)]
    const name = ch.answers[i].n
    if (p.found.includes(name)) return [ack(p.id, false, `${name} : déjà trouvé.`, p.found)]
    // Chains (each answer starts with the last letter of the previous one).
    const last = p.found.at(-1)
    if (ch.chain && last && firstLetter(name) !== lastLetter(last)) return [ack(p.id, false, `${name} ne commence pas par « ${lastLetter(last).toUpperCase()} ».`, p.found)]
    p.found.push(name)
    return [ack(p.id, true, `✓ ${name}`, p.found)]
  }

  private advanceTurn(now: number) {
    const t = this.data.turn!
    const alive = t.order.filter((id) => this.player(id)?.alive && this.player(id)?.connected)
    if (alive.length <= 1 && t.order.length > 1) return this.closeQuestion(now)
    for (let step = 1; step <= t.order.length; step++) {
      const pos = (t.pos + step) % t.order.length
      const pl = this.player(t.order[pos])
      if (pl?.alive && pl.connected) {
        t.pos = pos
        t.deadline = now + TURN_MS
        return
      }
    }
    this.closeQuestion(now)
  }

  private eliminateCurrent(now: number) {
    const t = this.data.turn
    if (!t) return
    const pl = this.player(t.order[t.pos])
    if (pl) pl.alive = false
    const alive = t.order.filter((id) => this.player(id)?.alive && this.player(id)?.connected)
    if (alive.length <= (t.order.length > 1 ? 1 : 0)) return this.closeQuestion(now)
    this.advanceTurn(now)
  }

  private openQuestion(index: number, now: number) {
    const d = this.data
    d.index = index
    d.answers = {}
    d.reveal = null
    d.phase = 'question'
    d.questionStart = now
    for (const p of d.players) {
      p.found = []
      p.alive = p.connected
    }
    if (this.turnMode) {
      const order = [...this.connected()].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => p.id)
      // Rotate who starts at each round.
      const start = order.length ? index % order.length : 0
      d.turn = { order: [...order.slice(start), ...order.slice(0, start)], pos: 0, deadline: now + TURN_MS, used: [] }
      d.deadline = null
    } else {
      d.turn = null
      d.deadline = d.config.questionTime === null ? null : now + d.config.questionTime * 1000
    }
  }

  private closeQuestion(now: number) {
    const d = this.data
    const ch = this.ch
    if (!ch || d.phase !== 'question') return
    const game = getGame(d.gameId)!
    const rules = rulesFor(game, d.config)
    const limitMs = d.config.questionTime === null ? null : d.config.questionTime * 1000
    const results: PlayerRoundResult[] = []
    const matchedCount: Record<string, number> = {}
    const graded = d.players.map((p) => {
      const a = d.answers[p.id]
      const response: Response | null = ch.kind === 'list' ? { kind: 'list', found: p.found } : (a?.response ?? null)
      const g = response ? grade(ch, response) : { ratio: 0, correct: false }
      if (g.matched && ch.kind === 'rare') matchedCount[g.matched] = (matchedCount[g.matched] ?? 0) + 1
      const timeMs = a ? a.at - d.questionStart : (limitMs ?? now - d.questionStart)
      return { p, response, g, timeMs }
    })
    const winners = this.turnMode ? d.players.filter((p) => p.alive && p.connected) : []
    for (const { p, response, g, timeMs } of graded) {
      const streak = g.correct ? p.streak + 1 : 0
      let points = scoreAnswer({ grade: g, d: ch.d, timeMs, limitMs, streak, rules }).total
      // Same rare answer given by several players: they share its points.
      if (ch.kind === 'rare' && g.matched) points = Math.round(points / matchedCount[g.matched])
      if (this.turnMode) points = Math.round(p.found.length * LIST_POINTS * DIFF_MULT[ch.d] + (winners.length === 1 && winners[0].id === p.id ? 200 * DIFF_MULT[ch.d] : 0))
      p.score += points
      p.streak = streak
      p.bestStreak = Math.max(p.bestStreak, streak)
      p.answered += 1
      p.correct += g.correct ? 1 : 0
      p.timeMs += Math.max(0, timeMs)
      results.push({ id: p.id, answer: describe(ch, response), points, correct: g.correct })
    }
    d.reveal = { ...revealOf(ch), results }
    d.turn = null
    d.phase = 'reveal'
    d.deadline = now + REVEAL_MS
  }

  private finish() {
    const d = this.data
    d.phase = 'results'
    d.deadline = null
    d.reveal = null
    d.final = [...d.players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ id: p.id, name: p.name, score: p.score, correct: p.correct, answered: p.answered, avgMs: p.answered ? Math.round(p.timeMs / p.answered) : 0, bestStreak: p.bestStreak }))
  }

  /** Time-driven transitions. Returns true when something changed. */
  tick(now: number): boolean {
    const d = this.data
    if (d.phase === 'countdown' && d.deadline !== null && now >= d.deadline) {
      this.openQuestion(0, now)
      return true
    }
    if (d.phase === 'question' && d.turn && now >= d.turn.deadline) {
      this.eliminateCurrent(now)
      return true
    }
    if (d.phase === 'question' && !d.turn && d.deadline !== null && now >= d.deadline + GRACE_MS) {
      this.closeQuestion(now)
      return true
    }
    if (d.phase === 'reveal' && d.deadline !== null && now >= d.deadline) {
      if (d.index + 1 < d.challenges.length) this.openQuestion(d.index + 1, now)
      else this.finish()
      return true
    }
    return false
  }

  nextAlarm(): number | null {
    const d = this.data
    if (d.phase === 'question' && d.turn) return d.turn.deadline
    if (d.phase === 'question') return d.deadline === null ? null : d.deadline + GRACE_MS
    if (d.phase === 'countdown' || d.phase === 'reveal') return d.deadline
    return null
  }

  publicState(now: number): PublicRoom {
    const d = this.data
    const ch = this.ch
    const inGame = d.phase === 'question' || d.phase === 'reveal'
    return {
      code: d.code,
      hostId: d.hostId,
      phase: d.phase,
      gameId: d.gameId,
      config: d.config,
      players: d.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, score: p.score, answered: !!d.answers[p.id], found: p.found.length, alive: p.alive })),
      index: d.index,
      total: d.challenges.length,
      deadline: d.deadline,
      serverNow: now,
      challenge: inGame && ch ? toPublic(ch) : null,
      reveal: d.phase === 'reveal' ? d.reveal : null,
      turn: d.turn ? { playerId: d.turn.order[d.turn.pos], deadline: d.turn.deadline, used: d.turn.used } : null,
      final: d.final,
    }
  }
}

function describe(ch: Challenge, r: Response | null): string {
  if (!r) return '—'
  switch (r.kind) {
    case 'mcq': return r.choice === null || ch.kind !== 'mcq' ? '—' : ch.choices[r.choice]
    case 'text':
    case 'rare': return r.text ?? '—'
    case 'estimate': return r.value === null ? '—' : r.value.toLocaleString('fr-FR')
    case 'order': return `${Math.round(grade(ch, r).ratio * 100)} % bien placé`
    case 'list': return `${r.found.length} réponse${r.found.length > 1 ? 's' : ''}`
    default: return '—'
  }
}
