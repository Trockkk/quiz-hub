import type { ReactNode } from 'react'
import type { Config, GameMeta } from '../core/types'
import { describeConfig } from '../lib/format'
import { href } from '../lib/router'
import type { RecordResult } from '../lib/store'

/** End screen for the games that do not use the question engine (memory, reflexes). */
export function EndCard({ game, config, score, stats, result, onReplay, onExit, children }: {
  game: GameMeta
  config: Config
  score: number
  stats: [string, string][]
  result: RecordResult | null
  onReplay: () => void
  onExit: () => void
  children?: ReactNode
}) {
  return (
    <div className="card relative mx-auto max-w-2xl animate-pop overflow-hidden p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.35),transparent_60%)]" />
      <div className="relative">
        <p className="text-sm text-slate-400">{game.icon} {game.title} · Partie terminée</p>
        {result?.isRecord && <p className="chip mx-auto mt-3 border-amber-400/50 text-amber-300">🏆 Nouveau record personnel !</p>}
        <p className="mt-3 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-6xl font-extrabold tabular-nums text-transparent">{score.toLocaleString('fr-FR')}</p>
        <p className="text-xs text-slate-500">{describeConfig(game, config)}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/5 p-3">
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
        {children}
        {result?.achievements.map((a) => (
          <p key={a.id} className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm">
            <span className="text-xl">{a.icon}</span> Succès débloqué : <strong>{a.title}</strong>
          </p>
        ))}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button autoFocus className="btn-primary" onClick={onReplay}>🔄 Rejouer</button>
          <a className="btn-ghost" href={href('game', game.id)}>⚙️ Changer les paramètres</a>
          <button className="btn-ghost" onClick={onExit}>Retour</button>
        </div>
      </div>
    </div>
  )
}
