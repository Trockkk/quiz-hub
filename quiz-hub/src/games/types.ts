import type { ComponentType, LazyExoticComponent } from 'react'

export interface GameProps {
  /** Record key for this game + mode: pass it to recordSession(). */
  recordKey: string
  modeId: string
  onExit: () => void
}

export interface GameMode {
  id: string
  label: string
  icon?: string
  color?: string
}

/** Everything the hub needs to list, launch and track a mini-game. */
export interface GameDefinition {
  id: string
  title: string
  tagline: string
  icon: string
  color: string
  modes: GameMode[]
  component: LazyExoticComponent<ComponentType<GameProps>>
}

export const recordKey = (gameId: string, modeId: string) => `${gameId}:${modeId}`
