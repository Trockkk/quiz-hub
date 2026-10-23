import { useEffect, useState, type ReactNode } from 'react'
import { configFor, getGame } from '../core/catalog'
import { daily, todayKey } from '../core/games/special'
import type { Challenge } from '../core/types'
import { content, loadFootballers } from '../content/index'
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
  const round = <Round key={attempt} id={id} onReplay={replay} onExit={exit} />
  return game.portal === 'football' ? <Footballers>{round}</Footballers> : round
}

/** Waits for the footballer base, downloaded only for football games. */
function Footballers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(content.footballers.length > 0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!ready) loadFootballers().then(() => setReady(true), () => setFailed(true))
  }, [ready])
  if (failed) return <Empty>Impossible de charger la base des joueurs. Vérifiez votre connexion puis rechargez la page.</Empty>
  return ready ? children : <div className="card p-10 text-center text-slate-400"><span className="animate-pulse">Chargement des joueurs…</span></div>
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
