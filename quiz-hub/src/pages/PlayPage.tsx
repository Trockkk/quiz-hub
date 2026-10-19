import { useState } from 'react'
import { configFor, getGame } from '../core/catalog'
import { daily, todayKey } from '../core/games/special'
import type { Challenge } from '../core/types'
import { content } from '../content/index'
import { Empty } from '../components/ui'
import { href, navigate } from '../lib/router'
import { getSave } from '../lib/store'
import { GameRunner } from '../play/GameRunner'
import { Memory } from '../play/Memory'
import { Reflex } from '../play/Reflex'

export function PlayPage({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0)
  const game = getGame(id)
  if (!game || game.multiOnly) return <Empty>Ce jeu n'existe pas en solo. <a className="text-violet-300 underline" href={href('games')}>Voir tous les jeux</a></Empty>
  // Settings come from the configuration screen (saved preferences).
  const config = configFor(game, getSave().prefs[game.id])
  const exit = () => navigate('portal', game.portal)
  const replay = () => setAttempt((a) => a + 1)

  if (game.custom === 'memory') return <Memory key={attempt} game={game} config={config} onReplay={replay} onExit={exit} />
  if (game.custom === 'reflex') return <Reflex key={attempt} game={game} config={config} onReplay={replay} onExit={exit} />
  return <Round key={attempt} id={id} onReplay={replay} onExit={exit} />
}

function Round({ id, onReplay, onExit }: { id: string; onReplay: () => void; onExit: () => void }) {
  const game = getGame(id)!
  const save = getSave()
  const [config] = useState(() => configFor(game, save.prefs[game.id]))
  const day = todayKey()
  const countsForDaily = game.id === 'daily' && !save.daily.results[day]
  const [challenges] = useState<Challenge[]>(() => {
    const ctx = { content, config, rng: Math.random, recent: new Set(save.recent) }
    return game.id === 'daily' ? daily(ctx, day) : game.generate!(ctx)
  })
  if (challenges.length === 0) return <Empty>Aucune question ne correspond à ces paramètres. <a className="text-violet-300 underline" href={href('game', id)}>Modifier les paramètres</a></Empty>
  return <GameRunner game={game} config={config} challenges={challenges} day={countsForDaily ? day : undefined} onReplay={onReplay} onExit={onExit} />
}
