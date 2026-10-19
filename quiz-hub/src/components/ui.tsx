import type { ReactNode } from 'react'
import { href } from '../lib/router'
import { useSave } from '../lib/store'
import { recordKey, type GameDefinition } from '../games/types'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: color + '22', boxShadow: `inset 0 0 0 1px ${color}44` }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
        <p className="truncate text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

/** Large card for a mini-game, with one launch button per mode. */
export function GameCard({ game }: { game: GameDefinition }) {
  const { data } = useSave()
  return (
    <article className="card group relative overflow-hidden p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-30 blur-3xl transition group-hover:opacity-50"
        style={{ background: game.color }}
      />
      <div className="relative">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/5 text-3xl ring-1 ring-white/10">{game.icon}</span>
          <div>
            <h3 className="text-xl font-bold">{game.title}</h3>
            <p className="text-sm text-slate-400">{game.tagline}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {game.modes.map((m) => {
            const best = data.records[recordKey(game.id, m.id)]?.best
            return (
              <a
                key={m.id}
                href={href('play', game.id, m.id)}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
                style={{ borderColor: (m.color ?? game.color) + '40' }}
              >
                <span className="truncate">
                  {m.icon} {m.label}
                </span>
                <span className="shrink-0 text-xs text-slate-400 tabular-nums">{best !== undefined ? `🏆 ${best}` : 'Jouer →'}</span>
              </a>
            )
          })}
        </div>
      </div>
    </article>
  )
}
