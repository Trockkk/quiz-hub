import { useMemo, useState, type ReactNode } from 'react'
import { configFor, configKey } from '../core/catalog'
import { normalize } from '../core/text'
import { DIFFICULTY_LABELS, type Difficulty, type GameMeta, type GameType, type PlayMode } from '../core/types'
import { MODE_LABELS, TYPE_LABELS, gameHref, portalOf } from '../lib/games'
import { useSave } from '../lib/store'


export function PageHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: string }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-4">
        {icon && <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/5 text-3xl ring-1 ring-white/10">{icon}</span>}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
        </div>
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

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card p-6 text-center text-slate-400">{children}</p>
}


/** Clickable game card: icon, description, levels, modes, personal best for the saved settings. */
export function GameCard({ game, compact }: { game: GameMeta; compact?: boolean }) {
  const { data } = useSave()
  const portal = portalOf(game)
  const config = configFor(game, data.prefs[game.id])
  const best = data.records[configKey(game, config)]?.best
  return (
    <a
      href={gameHref(game)}
      className="card group relative flex flex-col overflow-hidden p-5 transition duration-200 hover:-translate-y-1 hover:border-white/15"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-20 blur-3xl transition group-hover:opacity-40" style={{ background: portal.color }} />
      <div className="relative flex items-start gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-2xl text-3xl shadow-lg transition group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${portal.color}55, ${portal.color}15)`, boxShadow: `inset 0 0 0 1px ${portal.color}55` }}
          aria-hidden
        >
          {game.icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-bold leading-tight">{game.title}</h3>
          <p className={`mt-1 text-sm text-slate-400 ${compact ? 'line-clamp-2' : ''}`}>{game.tagline}</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        <span className="chip">{TYPE_LABELS[game.type]}</span>
        <span className="chip">{game.options.difficulty ? '4 niveaux' : (game.fixedDifficulty?.split(' :')[0] ?? 'Standard')}</span>
        {game.modes.map((m) => (
          <span key={m} className="chip" style={m === 'multi' ? { color: '#a5b4fc', borderColor: '#6366f155' } : m === 'daily' ? { color: '#f9a8d4', borderColor: '#ec489955' } : undefined}>
            {MODE_LABELS[m]}
          </span>
        ))}
      </div>
      <p className="relative mt-auto pt-4 text-xs font-semibold" style={{ color: portal.color }}>
        {game.multiOnly ? 'Jouer avec des amis →' : best !== undefined ? `🏆 Record : ${best.toLocaleString('fr-FR')} pts` : 'Configurer et jouer →'}
      </p>
    </a>
  )
}

const DIFF_FILTERS: (Difficulty | 'all')[] = ['all', 1, 2, 3, 4]

/** Search + filters (difficulty, type, mode) over a list of games. */
export function GameBrowser({ games, autoFocus }: { games: GameMeta[]; autoFocus?: boolean }) {
  const [query, setQuery] = useState('')
  const [diff, setDiff] = useState<Difficulty | 'all'>('all')
  const [type, setType] = useState<GameType | 'all'>('all')
  const [mode, setMode] = useState<PlayMode | 'all'>('all')
  const types = [...new Set(games.map((g) => g.type))]
  const filtered = useMemo(() => {
    const q = normalize(query)
    return games.filter(
      (g) =>
        (!q || normalize(`${g.title} ${g.tagline} ${portalOf(g).title} ${g.rules.join(' ')}`).includes(q)) &&
        (diff === 'all' || g.options.difficulty || diff === 4 && g.id === 'impossible') &&
        (type === 'all' || g.type === type) &&
        (mode === 'all' || g.modes.includes(mode)),
    )
  }, [games, query, diff, type, mode])

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`

  return (
    <div>
      <div className="card flex flex-col gap-3 p-4">
        <label className="relative block">
          <span className="sr-only">Rechercher un jeu</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>🔍</span>
          <input
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un mini-jeu : drapeau, logique, chrono…"
            className="w-full rounded-xl border border-white/10 bg-ink-950/60 py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-violet-400"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Niveau</span>
          {DIFF_FILTERS.map((d) => (
            <button key={d} className={chip(diff === d)} aria-pressed={diff === d} onClick={() => setDiff(d)}>
              {d === 'all' ? 'Tous' : DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Type</span>
          <button className={chip(type === 'all')} aria-pressed={type === 'all'} onClick={() => setType('all')}>Tous</button>
          {types.map((t) => (
            <button key={t} className={chip(type === t)} aria-pressed={type === t} onClick={() => setType(t)}>{TYPE_LABELS[t]}</button>
          ))}
          <span className="ml-2 font-semibold text-slate-500">Mode</span>
          {(['all', 'solo', 'multi', 'daily'] as const).map((m) => (
            <button key={m} className={chip(mode === m)} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'all' ? 'Tous' : MODE_LABELS[m]}</button>
          ))}
        </div>
      </div>
      <p className="mb-3 mt-4 text-sm text-slate-500" aria-live="polite">{filtered.length} jeu{filtered.length > 1 ? 'x' : ''}</p>
      {filtered.length === 0 ? (
        <Empty>Aucun jeu ne correspond à ces filtres.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g) => <GameCard key={g.id} game={g} compact />)}
        </div>
      )}
    </div>
  )
}
