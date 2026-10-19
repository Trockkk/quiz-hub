import { useSyncExternalStore } from 'react'
import { newAchievements, type Achievement } from './achievements'
import { addDaily, addSession, defaultSave, loadSave, parseSave, writeSave, type SaveData, type SessionInput } from './storage'

let state = loadSave()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function set(data: SaveData, error = writeSave(data) ?? state.error) {
  state = { data, error }
  listeners.forEach((l) => l())
}

export const useSave = () => useSyncExternalStore(subscribe, () => state)

export const getSave = () => state.data

export const updateSave = (fn: (data: SaveData) => SaveData) => set(fn(state.data))

export const dismissStorageError = () => set(state.data, null)

export const resetSave = () => set(defaultSave())

export interface RecordResult {
  isRecord: boolean
  previousBest: number | null
  achievements: Achievement[]
}

/** Records a finished game: record, stats, history, achievements (and the daily challenge). */
export function recordSession(session: SessionInput, daily?: { day: string; grid: string }): RecordResult {
  const result = addSession(state.data, session)
  let data = result.data
  if (daily) data = addDaily(data, daily.day, session.score, daily.grid)
  const unlocked = newAchievements(data, session)
  const date = new Date().toISOString()
  data = { ...data, achievements: { ...data.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, date])) } }
  set(data)
  return { isRecord: result.isRecord, previousBest: result.previousBest, achievements: unlocked }
}

/** Imports a save exported from the settings page. Returns an error message or null. */
export function importSave(raw: string): string | null {
  const { data, error } = parseSave(raw)
  if (error) return error
  set(data)
  return null
}
