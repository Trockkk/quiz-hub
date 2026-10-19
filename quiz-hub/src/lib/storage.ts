// Versioned save stored in localStorage. Everything read back is validated: the user (or an old version) may have left anything there.
import type { Config, Difficulty } from '../core/types'

export const STORAGE_KEY = 'quizhub:save'
export const BACKUP_KEY = 'quizhub:save:backup'
export const SAVE_VERSION = 2
const HISTORY_LIMIT = 60
const RECENT_LIMIT = 400
const DAILY_LIMIT = 60

export interface GameRecord {
  best: number
  plays: number
  bestStreak: number
  lastPlayed: string
  /** human-readable settings, e.g. "Difficile · 10 questions · 15 s" */
  label: string
}

/** Aggregated stats, keyed by "all", "game:<id>", "portal:<id>", "diff:<n>", "theme:<id>". */
export interface Agg {
  plays: number
  correct: number
  answered: number
  timeMs: number
  bestStreak: number
}

export interface Session {
  key: string
  gameId: string
  score: number
  correct: number
  answered: number
  avgMs: number
  bestStreak: number
  d: Difficulty
  date: string
  label: string
}

export interface DailyState {
  last: string | null
  streak: number
  best: number
  results: Record<string, { score: number; grid: string }>
}

export interface SaveData {
  version: number
  player: { name: string }
  prefs: Record<string, Partial<Config>>
  records: Record<string, GameRecord>
  stats: Record<string, Agg>
  history: Session[]
  achievements: Record<string, string>
  daily: DailyState
  /** recently seen challenge ids, to avoid repeats */
  recent: string[]
}

export interface LoadResult {
  data: SaveData
  error: string | null
}

type Obj = Record<string, unknown>

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  player: { name: '' },
  prefs: {},
  records: {},
  stats: {},
  history: [],
  achievements: {},
  daily: { last: null, streak: 0, best: 0, results: {} },
  recent: [],
})

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
const isDiff = (v: unknown): v is Difficulty => v === 1 || v === 2 || v === 3 || v === 4

// Each entry upgrades a save from version N to N+1. Add one (and bump SAVE_VERSION) whenever SaveData changes shape.
const migrations: Record<number, (save: Obj) => Obj> = {
  // v1 (first quiz only) → v2 (platform): settings become the classic quiz preferences, old records are kept.
  1: (v1) => {
    const settings = isObj(v1.settings) ? v1.settings : {}
    const records: Record<string, GameRecord> = {}
    const all: Agg = { plays: 0, correct: 0, answered: 0, timeMs: 0, bestStreak: 0 }
    for (const [key, r] of Object.entries(isObj(v1.records) ? v1.records : {})) {
      if (!isObj(r) || !isCount(r.best) || !isCount(r.plays) || !isCount(r.totalCorrect) || !isCount(r.totalAnswered) || !isDate(r.lastPlayed)) continue
      const mode = key.split(':')[1] ?? 'all'
      records[`classic|legacy|${mode}`] = { best: r.best, plays: r.plays, bestStreak: 0, lastPlayed: r.lastPlayed, label: `Ancienne version · ${mode === 'all' ? 'toutes catégories' : mode}` }
      all.plays += r.plays
      all.correct += r.totalCorrect
      all.answered += r.totalAnswered
    }
    const history = (Array.isArray(v1.history) ? v1.history : []).filter(isObj).map((s) => ({
      key: `classic|legacy|${str(s.key).split(':')[1] ?? 'all'}`,
      gameId: 'classic',
      score: s.score,
      correct: s.correct,
      answered: s.total,
      avgMs: 0,
      bestStreak: 0,
      d: 1,
      date: s.date,
      label: 'Ancienne version',
    }))
    const qTime = settings.secondsPerQuestion === 10 || settings.secondsPerQuestion === 15 || settings.secondsPerQuestion === 30 ? settings.secondsPerQuestion : 15
    return {
      ...defaultSave(),
      version: 2,
      prefs: { classic: { count: isCount(settings.questionCount) ? settings.questionCount : 10, questionTime: qTime } },
      records,
      stats: { all, 'game:classic': { ...all } },
      history,
    }
  },
}

function sanitizeAgg(v: unknown): Agg | null {
  if (!isObj(v) || ![v.plays, v.correct, v.answered, v.timeMs, v.bestStreak].every(isCount)) return null
  return { plays: v.plays as number, correct: v.correct as number, answered: v.answered as number, timeMs: v.timeMs as number, bestStreak: v.bestStreak as number }
}

function sanitizePrefs(v: unknown): Partial<Config> {
  if (!isObj(v)) return {}
  const out: Partial<Config> = {}
  if (isDiff(v.difficulty)) out.difficulty = v.difficulty
  if (isCount(v.count) && v.count <= 100) out.count = v.count
  if (v.questionTime === null || (isCount(v.questionTime) && v.questionTime <= 600)) out.questionTime = v.questionTime as number | null
  if (v.totalTime === null || (isCount(v.totalTime) && v.totalTime <= 3600)) out.totalTime = v.totalTime as number | null
  if (Array.isArray(v.themes)) out.themes = v.themes.filter((t): t is string => typeof t === 'string').slice(0, 20)
  if (v.answerType === 'qcm' || v.answerType === 'text' || v.answerType === 'mixed') out.answerType = v.answerType
  for (const k of ['hints', 'explanations', 'shuffle'] as const) if (typeof v[k] === 'boolean') out[k] = v[k] as boolean
  if (typeof v.variant === 'string') out.variant = str(v.variant, 30)
  return out
}

function sanitize(save: Obj): SaveData {
  const base = defaultSave()
  const records: Record<string, GameRecord> = {}
  for (const [key, r] of Object.entries(isObj(save.records) ? save.records : {})) {
    if (isObj(r) && isCount(r.best) && isCount(r.plays) && isCount(r.bestStreak) && isDate(r.lastPlayed)) {
      records[key] = { best: r.best, plays: r.plays, bestStreak: r.bestStreak, lastPlayed: r.lastPlayed, label: str(r.label) }
    }
  }
  const stats: Record<string, Agg> = {}
  for (const [key, a] of Object.entries(isObj(save.stats) ? save.stats : {})) {
    const s = sanitizeAgg(a)
    if (s) stats[key] = s
  }
  const prefs: Record<string, Partial<Config>> = {}
  for (const [key, p] of Object.entries(isObj(save.prefs) ? save.prefs : {})) prefs[key] = sanitizePrefs(p)
  const history = (Array.isArray(save.history) ? save.history : [])
    .filter((s): s is Session => isObj(s) && typeof s.key === 'string' && typeof s.gameId === 'string' && [s.score, s.correct, s.answered, s.avgMs, s.bestStreak].every(isCount) && isDiff(s.d) && isDate(s.date))
    .map((s) => ({ key: s.key, gameId: s.gameId, score: s.score, correct: s.correct, answered: s.answered, avgMs: s.avgMs, bestStreak: s.bestStreak, d: s.d, date: s.date, label: str(s.label) }))
    .slice(0, HISTORY_LIMIT)
  const achievements: Record<string, string> = {}
  for (const [k, v] of Object.entries(isObj(save.achievements) ? save.achievements : {})) if (isDate(v)) achievements[k] = v
  const d = isObj(save.daily) ? save.daily : {}
  const results: DailyState['results'] = {}
  for (const [day, r] of Object.entries(isObj(d.results) ? d.results : {}).slice(-DAILY_LIMIT)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isObj(r) && isCount(r.score)) results[day] = { score: r.score, grid: str(r.grid, 100) }
  }
  const player = isObj(save.player) ? save.player : {}
  return {
    version: SAVE_VERSION,
    player: { name: str(player.name, 20) },
    prefs,
    records,
    stats,
    history,
    achievements,
    daily: {
      last: typeof d.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.last) ? d.last : null,
      streak: isCount(d.streak) ? d.streak : 0,
      best: isCount(d.best) ? d.best : 0,
      results,
    },
    recent: (Array.isArray(save.recent) ? save.recent : base.recent).filter((x): x is string => typeof x === 'string').slice(-RECENT_LIMIT),
  }
}

/** Pure: turns the raw stored string into a valid save. Never throws. */
export function parseSave(raw: string | null): LoadResult {
  if (raw === null) return { data: defaultSave(), error: null }
  const reset = (error: string): LoadResult => ({ data: defaultSave(), error })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return reset('Sauvegarde illisible : progression réinitialisée (une copie a été conservée).')
  }
  if (!isObj(parsed) || !isCount(parsed.version)) return reset('Sauvegarde invalide : progression réinitialisée (une copie a été conservée).')
  if (parsed.version > SAVE_VERSION) return reset('Sauvegarde créée par une version plus récente de Quiz Hub : une copie a été conservée.')
  let save = parsed
  for (let v = parsed.version; v < SAVE_VERSION; v++) {
    const migrate = migrations[v]
    if (!migrate) return reset(`Sauvegarde v${v} non migrable : progression réinitialisée (une copie a été conservée).`)
    save = migrate(save)
  }
  return { data: sanitize(save), error: null }
}

export function loadSave(): LoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { data: defaultSave(), error: 'Stockage local indisponible : la progression ne sera pas sauvegardée.' }
  }
  const result = parseSave(raw)
  if (result.error && raw !== null) {
    // Keep the unreadable save so a reset never silently destroys data.
    try {
      localStorage.setItem(BACKUP_KEY, raw)
    } catch {
      /* nothing more we can do */
    }
  }
  return result
}

/** Returns an error message, or null on success. */
export function writeSave(data: SaveData): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return null
  } catch {
    return 'Impossible d’enregistrer la progression (stockage plein ou bloqué).'
  }
}

export interface SessionInput extends Session {
  portal: string
  /** theme → [correct, answered] */
  perTheme: Record<string, [number, number]>
  timeMs: number
  seen: string[]
}

const addAgg = (a: Agg | undefined, s: SessionInput, correct = s.correct, answered = s.answered): Agg => ({
  plays: (a?.plays ?? 0) + 1,
  correct: (a?.correct ?? 0) + correct,
  answered: (a?.answered ?? 0) + answered,
  timeMs: (a?.timeMs ?? 0) + s.timeMs,
  bestStreak: Math.max(a?.bestStreak ?? 0, s.bestStreak),
})

/** Pure: adds a finished game, updates the personal record and every statistic. */
export function addSession(data: SaveData, s: SessionInput): { data: SaveData; isRecord: boolean; previousBest: number | null } {
  const prev = data.records[s.key]
  const isRecord = s.score > (prev?.best ?? 0)
  const stats = { ...data.stats }
  for (const k of ['all', `game:${s.gameId}`, `portal:${s.portal}`, `diff:${s.d}`]) stats[k] = addAgg(stats[k], s)
  for (const [theme, [c, n]] of Object.entries(s.perTheme)) stats[`theme:${theme}`] = addAgg(stats[`theme:${theme}`], s, c, n)
  const { portal: _p, perTheme: _t, timeMs: _m, seen, ...session } = s
  return {
    isRecord,
    previousBest: prev?.best ?? null,
    data: {
      ...data,
      records: {
        ...data.records,
        [s.key]: { best: Math.max(prev?.best ?? 0, s.score), plays: (prev?.plays ?? 0) + 1, bestStreak: Math.max(prev?.bestStreak ?? 0, s.bestStreak), lastPlayed: s.date, label: s.label },
      },
      stats,
      history: [session, ...data.history].slice(0, HISTORY_LIMIT),
      recent: [...data.recent.filter((id) => !seen.includes(id)), ...seen].slice(-RECENT_LIMIT),
    },
  }
}

/** Pure: records the daily challenge (only the first game of the day counts). */
export function addDaily(data: SaveData, day: string, score: number, grid: string): SaveData {
  if (data.daily.results[day]) return data
  const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const streak = data.daily.last === yesterday ? data.daily.streak + 1 : 1
  const results = Object.fromEntries(Object.entries({ ...data.daily.results, [day]: { score, grid } }).slice(-DAILY_LIMIT))
  return { ...data, daily: { last: day, streak, best: Math.max(data.daily.best, streak), results } }
}

export const accuracy = (a?: Agg) => (a?.answered ? Math.round((a.correct / a.answered) * 100) : 0)
