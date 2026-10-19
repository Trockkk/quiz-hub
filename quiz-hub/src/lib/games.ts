import { PORTALS } from '../core/catalog'
import type { GameMeta, GameType, PlayMode } from '../core/types'
import { href } from './router'

export const TYPE_LABELS: Record<GameType, string> = { quiz: 'Quiz', visuel: 'Visuel', logique: 'Logique', mots: 'Mots', rapidite: 'Rapidité', estimation: 'Estimation' }
export const MODE_LABELS: Record<PlayMode, string> = { solo: 'Solo', multi: 'Multijoueur', daily: 'Quotidien' }

export const portalOf = (game: GameMeta) => PORTALS.find((p) => p.id === game.portal)!

export const gameHref = (game: GameMeta) => (game.multiOnly ? href('multi') : href('game', game.id))
