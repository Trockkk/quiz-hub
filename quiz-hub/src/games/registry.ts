import { quizGame } from './quiz'
import type { GameDefinition } from './types'

// To add a mini-game: create src/games/<name>/index.ts exporting a GameDefinition, then add it here.
export const games: GameDefinition[] = [quizGame]

export const getGame = (id: string | undefined) => games.find((g) => g.id === id)

/** "quiz:histoire" -> { game, mode } for display in stats. */
export function describeKey(key: string) {
  const [gameId, modeId] = key.split(':')
  const game = getGame(gameId)
  const mode = game?.modes.find((m) => m.id === modeId)
  return { game, mode, label: game ? `${game.title} · ${mode?.label ?? modeId}` : key }
}
