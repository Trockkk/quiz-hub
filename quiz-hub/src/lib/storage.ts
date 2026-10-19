// Versioned save stored in localStorage. Everything read back is validated: the user (or an old version) may have left anything there.

export const STORAGE_KEY = 'quizhub:save'
export const BACKUP_KEY = 'quizhub:save:backup'
export const SAVE_VERSION = 1
const HISTORY_LIMIT = 30

export const QUESTION_COUNTS = [5, 10, 15, 20]
export const SECONDS_OPTIONS = [10, 15, 20, 30]

export interface Settings {
  questionCount: number
  secondsPerQuestion: number
}

export interface GameRecord {
  best: number
  plays: number
  totalCorrect: number
  totalAnswered: number
  lastPlayed: string
}

export interface Session {
  key: string
  score: number
  correct: number
  total: number
  date: string
}

export interface SaveData {
  version: number
  settings: Settings
  records: Record<string, GameRecord>
  history: Session[]
}

export interface LoadResult {
  data: SaveData
  error: string | null
}

type Obj = Record<string, unknown>

// Each entry upgrades a save from version N to N+1. Add one (and bump SAVE_VERSION) whenever SaveData changes shape.
const migrations: Record<number, (save: Obj) => Obj> = {}

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  settings: { questionCount: 10, secondsPerQuestion: 20 },
  records: {},
  history: [],
})

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const pick = (v: unknown, allowed: number[], fallback: number) =>
  typeof v === 'number' && allowed.includes(v) ? v : fallback

function sanitize(save: Obj): SaveData {
  const base = defaultSave()
  const settings = isObj(save.settings) ? save.settings : {}
  const records: Record<string, GameRecord> = {}
  if (isObj(save.records)) {
    for (const [key, r] of Object.entries(save.records)) {
      if (isObj(r) && isCount(r.best) && isCount(r.plays) && isCount(r.totalCorrect) && isCount(r.totalAnswered) && isDate(r.lastPlayed)) {
        records[key] = { best: r.best, plays: r.plays, totalCorrect: r.totalCorrect, totalAnswered: r.totalAnswered, lastPlayed: r.lastPlayed }
      }
    }
  }
  const history = Array.isArray(save.history)
    ? save.history
        .filter((s): s is Session => isObj(s) && typeof s.key === 'string' && isCount(s.score) && isCount(s.correct) && isCount(s.total) && isDate(s.date))
        .map(({ key, score, correct, total, date }) => ({ key, score, correct, total, date }))
        .slice(0, HISTORY_LIMIT)
    : []
  return {
    version: SAVE_VERSION,
    settings: {
      questionCount: pick(settings.questionCount, QUESTION_COUNTS, base.settings.questionCount),
      secondsPerQuestion: pick(settings.secondsPerQuestion, SECONDS_OPTIONS, base.settings.secondsPerQuestion),
    },
    records,
    history,
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

export function totals(data: SaveData) {
  const records = Object.values(data.records)
  const plays = records.reduce((s, r) => s + r.plays, 0)
  const answered = records.reduce((s, r) => s + r.totalAnswered, 0)
  const correct = records.reduce((s, r) => s + r.totalCorrect, 0)
  return {
    plays,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    best: Math.max(0, ...records.map((r) => r.best)),
  }
}

/** Pure: adds a finished session, updates the personal record. */
export function addSession(data: SaveData, session: Session): { data: SaveData; isRecord: boolean } {
  const prev = data.records[session.key]
  const isRecord = session.score > (prev?.best ?? 0)
  const record: GameRecord = {
    best: Math.max(prev?.best ?? 0, session.score),
    plays: (prev?.plays ?? 0) + 1,
    totalCorrect: (prev?.totalCorrect ?? 0) + session.correct,
    totalAnswered: (prev?.totalAnswered ?? 0) + session.total,
    lastPlayed: session.date,
  }
  return {
    data: { ...data, records: { ...data.records, [session.key]: record }, history: [session, ...data.history].slice(0, HISTORY_LIMIT) },
    isRecord,
  }
}
