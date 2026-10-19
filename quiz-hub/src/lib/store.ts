import { useSyncExternalStore } from 'react'
import { addSession, defaultSave, loadSave, writeSave, type SaveData, type Session } from './storage'

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

export const updateSave = (fn: (data: SaveData) => SaveData) => set(fn(state.data))

export const dismissStorageError = () => set(state.data, null)

export const resetSave = () => set(defaultSave())

/** Records a finished game and returns whether it beat the personal record. */
export function recordSession(session: Session): boolean {
  const result = addSession(state.data, session)
  set(result.data)
  return result.isRecord
}
