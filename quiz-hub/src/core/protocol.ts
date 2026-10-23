// Multiplayer protocol, shared by the website and the server (server/).
// Rule: the client never receives what would let it cheat (answers) before the question is closed.
import type { Challenge, Config, Difficulty, Response } from './types.ts'

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 5
export const MAX_PLAYERS = 12
export const MAX_NAME = 20
export const COUNTDOWN_MS = 3000
export const REVEAL_MS = 6000
/** Network latency allowance on answer deadlines. */
export const GRACE_MS = 500
/** "Last one standing": time per turn. */
export const TURN_MS = 15000

export const isRoomCode = (s: string) => s.length === CODE_LENGTH && [...s].every((c) => CODE_ALPHABET.includes(c))

export function cleanName(raw: unknown, fallback: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters from player names is the point
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_NAME) : ''
  return s || fallback
}

/** A challenge as sent before it is answered: no answer, no explanation. */
export type PublicChallenge =
  | { kind: 'mcq'; id: string; d: Difficulty; prompt: string; media?: Challenge['media']; choices: string[]; choiceFlags?: string[] }
  | { kind: 'text'; id: string; d: Difficulty; prompt: string; media?: Challenge['media']; numeric?: boolean }
  | { kind: 'estimate'; id: string; d: Difficulty; prompt: string; media?: Challenge['media']; unit: string }
  | { kind: 'order'; id: string; d: Difficulty; prompt: string; items: string[]; dir: 'asc' | 'desc' }
  | { kind: 'list'; id: string; d: Difficulty; prompt: string; total: number; chain?: boolean }
  | { kind: 'rare'; id: string; d: Difficulty; prompt: string; rule: string }

export const MULTI_KINDS = ['mcq', 'text', 'estimate', 'order', 'list', 'rare'] as const

export function toPublic(ch: Challenge): PublicChallenge | null {
  const base = { id: ch.id, d: ch.d, prompt: ch.prompt }
  // Logos are revealed in full in multiplayer (the reveal effect depends on each client's clock).
  const media = ch.media?.type === 'logo' ? { ...ch.media, reveal: false } : ch.media
  switch (ch.kind) {
    case 'mcq': return { ...base, kind: 'mcq', media, choices: ch.choices, choiceFlags: ch.choiceFlags }
    case 'text': return { ...base, kind: 'text', media, numeric: ch.numeric }
    case 'estimate': return { ...base, kind: 'estimate', media, unit: ch.unit }
    case 'order': return { ...base, kind: 'order', items: ch.items, dir: ch.dir }
    case 'list': return { ...base, kind: 'list', total: ch.answers.length, chain: ch.chain }
    case 'rare': return { ...base, kind: 'rare', rule: ch.rule }
    default: return null
  }
}

/** What is shown once the question is closed. */
export interface Reveal {
  answer: string
  explanation?: string
  /** order: items in the right order with their values; rare / list: answers grouped */
  details?: string[]
}

export function revealOf(ch: Challenge): Reveal {
  switch (ch.kind) {
    case 'mcq': return { answer: ch.choices[ch.answer], explanation: ch.explanation }
    case 'text': return { answer: ch.display, explanation: ch.explanation }
    case 'estimate': return { answer: `${ch.answer.toLocaleString('fr-FR')} ${ch.unit}`.trim(), explanation: ch.explanation }
    case 'order': {
      const idx = ch.items.map((_, i) => i).sort((a, b) => (ch.dir === 'asc' ? ch.values[a] - ch.values[b] : ch.values[b] - ch.values[a]))
      return { answer: idx.map((i) => ch.items[i]).join(' → '), details: idx.map((i) => `${ch.items[i]} : ${ch.labels[i]}`) }
    }
    case 'list': return { answer: `${ch.answers.length} réponses possibles`, details: ch.answers.map((a) => a.n) }
    case 'rare': return { answer: 'Barème de rareté', details: ([4, 3, 2, 1] as const).map((t) => `${['', 'Courant', 'Peu courant', 'Rare', 'Très rare'][t]} : ${ch.answers.filter((a) => a.tier === t).map((a) => a.n).join(', ')}`).filter((l) => !l.endsWith(': ')) }
    default: return { answer: '' }
  }
}

/** Validates the shape of an untrusted response for a challenge. */
export function validResponse(ch: Challenge, r: unknown): r is Response {
  if (typeof r !== 'object' || r === null) return false
  const x = r as Record<string, unknown>
  if (x.kind !== ch.kind) return false
  switch (ch.kind) {
    case 'mcq': return x.choice === null || (Number.isInteger(x.choice) && (x.choice as number) >= 0 && (x.choice as number) < ch.choices.length)
    case 'text':
    case 'rare': return x.text === null || (typeof x.text === 'string' && x.text.length <= 100)
    case 'estimate': return x.value === null || (typeof x.value === 'number' && Number.isFinite(x.value))
    case 'order': {
      const o = x.order
      return Array.isArray(o) && o.length === ch.items.length && new Set(o).size === o.length && o.every((i) => Number.isInteger(i) && i >= 0 && i < ch.items.length)
    }
    default: return false
  }
}

export interface PublicPlayer {
  id: string
  name: string
  connected: boolean
  score: number
  /** answered the current question (or number of list answers found) */
  answered: boolean
  found: number
  /** "last one standing": still in the round */
  alive: boolean
}

export interface PlayerRoundResult {
  id: string
  answer: string
  points: number
  correct: boolean
}

export interface PlayerFinal {
  id: string
  name: string
  score: number
  correct: number
  answered: number
  avgMs: number
  bestStreak: number
}

/** Teammate chain: one cited footballer, who cited it and where they played with the previous one. */
export interface ChainLink {
  /** Wikidata id: homonyms stay distinct */
  id: number
  name: string
  by: string | null
  via: string | null
}

export interface ChainRun {
  links: ChainLink[]
  /** why the run stopped */
  end: string | null
}

export interface PublicRoom {
  code: string
  hostId: string | null
  phase: 'lobby' | 'countdown' | 'question' | 'reveal' | 'results'
  gameId: string
  config: Config
  players: PublicPlayer[]
  index: number
  total: number
  /** server timestamp (ms) of the current deadline, null when unlimited */
  deadline: number | null
  serverNow: number
  challenge: PublicChallenge | null
  reveal: (Reveal & { results: PlayerRoundResult[] }) | null
  /** "last one standing" */
  turn: { playerId: string; deadline: number; used: string[] } | null
  final: PlayerFinal[] | null
  /** teammate chain: one run per round */
  runs: ChainRun[]
}

export type ClientMessage =
  | { t: 'hello'; token: string; name: string }
  | { t: 'config'; gameId: string; config: Partial<Config> }
  | { t: 'start' }
  | { t: 'answer'; index: number; response: Response }
  | { t: 'guess'; index: number; text: string }
  | { t: 'skip' }
  | { t: 'replay' }
  | { t: 'leave' }
  | { t: 'ping' }

export type ServerMessage =
  | { t: 'welcome'; you: string }
  | { t: 'state'; room: PublicRoom }
  | { t: 'ack'; ok: boolean; msg: string; found?: string[] }
  | { t: 'error'; msg: string; fatal?: boolean }
  | { t: 'pong' }
