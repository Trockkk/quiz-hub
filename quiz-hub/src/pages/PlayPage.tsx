import { Suspense } from 'react'
import { getGame } from '../games/registry'
import { recordKey } from '../games/types'
import { href, navigate } from '../lib/router'

export function PlayPage({ gameId, modeId }: { gameId?: string; modeId?: string }) {
  const game = getGame(gameId)
  const mode = game?.modes.find((m) => m.id === modeId)
  if (!game || !mode) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Ce jeu n’existe pas (ou plus).</p>
        <a className="btn-primary mt-6" href={href('games')}>
          Voir les jeux
        </a>
      </div>
    )
  }
  const Game = game.component
  return (
    <Suspense fallback={<p className="text-center text-slate-400">Chargement…</p>}>
      <Game recordKey={recordKey(game.id, mode.id)} modeId={mode.id} onExit={() => navigate()} />
    </Suspense>
  )
}
