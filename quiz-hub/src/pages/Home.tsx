import { GAMES, PORTALS } from '../core/catalog'
import { todayKey } from '../core/games/special'
import { GameBrowser, Section, StatCard } from '../components/ui'
import { formatDate } from '../lib/format'
import { href } from '../lib/router'
import { accuracy } from '../lib/storage'
import { useSave } from '../lib/store'

export function Home() {
  const { data } = useSave()
  const all = data.stats.all
  const today = todayKey()
  const dailyDone = data.daily.results[today]
  const gameTitle = (id: string) => GAMES.find((g) => g.id === id)

  return (
    <>
      <section className="card relative mb-8 overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.2),transparent_50%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">Quiz Hub</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {data.player.name ? `Prêt, ${data.player.name} ?` : 'La culture G, version arcade.'}
            </h1>
            <p className="mt-3 max-w-xl text-slate-300">
              {GAMES.length} mini-jeux, plus de 500 questions écrites à la main, 195 pays, près de 150 logos, des défis quotidiens et des duels en direct avec vos amis.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={href('game', 'classic')} className="btn-primary">⚡ Jouer maintenant</a>
              <a href={href('multi')} className="btn-ghost">👥 Défier des amis</a>
            </div>
          </div>
          <a href={href('game', 'daily')} className="group rounded-2xl border border-pink-400/30 bg-pink-500/10 p-5 transition hover:-translate-y-1 hover:bg-pink-500/15 lg:w-72">
            <p className="text-sm font-semibold text-pink-200">📅 Défi du jour · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
            {dailyDone ? (
              <>
                <p className="mt-2 text-2xl font-bold">{dailyDone.score.toLocaleString('fr-FR')} pts</p>
                <p className="mt-1 text-lg tracking-wider">{dailyDone.grid}</p>
                <p className="mt-2 text-xs text-slate-400">Revenez demain pour un nouveau défi.</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold">10 épreuves vous attendent</p>
                <p className="mt-1 text-sm text-slate-300">Les mêmes pour tout le monde aujourd'hui.</p>
              </>
            )}
            <p className="mt-3 text-sm font-semibold text-orange-300">🔥 Série : {data.daily.streak} jour{data.daily.streak > 1 ? 's' : ''}</p>
          </a>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="🎯" label="Parties jouées" value={String(all?.plays ?? 0)} color="#8b5cf6" />
        <StatCard icon="📈" label="Précision" value={`${accuracy(all)} %`} color="#06b6d4" />
        <StatCard icon="🔥" label="Meilleure série" value={String(all?.bestStreak ?? 0)} color="#f97316" />
        <StatCard icon="🏅" label="Succès" value={String(Object.keys(data.achievements).length)} color="#f59e0b" />
      </div>

      <Section title="Catégories">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PORTALS.map((p) => {
            const count = GAMES.filter((g) => g.portal === p.id || g.alsoIn?.includes(p.id)).length
            return (
              <a key={p.id} href={href('portal', p.id)} className="card group relative overflow-hidden p-5 transition hover:-translate-y-1">
                <div className="pointer-events-none absolute inset-0 opacity-60 transition group-hover:opacity-100" style={{ background: `linear-gradient(135deg, ${p.color}26, transparent 60%)` }} />
                <div className="relative flex items-start gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-3xl transition group-hover:scale-110" style={{ background: p.color + '30', boxShadow: `inset 0 0 0 1px ${p.color}66` }}>{p.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold">{p.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{p.description}</p>
                    <p className="mt-3 text-xs font-semibold" style={{ color: p.color }}>{count} jeu{count > 1 ? 'x' : ''} →</p>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </Section>

      <Section title="Trouver un jeu">
        <GameBrowser games={GAMES} />
      </Section>

      <Section title="Activité récente" action={<a href={href('stats')} className="text-sm text-violet-300 hover:underline">Toutes les statistiques →</a>}>
        {data.history.length === 0 ? (
          <p className="card p-6 text-center text-slate-400">Aucune partie pour l'instant. Lancez-vous !</p>
        ) : (
          <ul className="card divide-y divide-white/5">
            {data.history.slice(0, 5).map((s, i) => {
              const g = gameTitle(s.gameId)
              return (
                <li key={i} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g?.icon} {g?.title ?? s.gameId}</p>
                    <p className="truncate text-xs text-slate-400">{formatDate(s.date)} · {s.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-violet-300">{s.score.toLocaleString('fr-FR')} pts</p>
                    <p className="text-xs text-slate-400">{s.correct}/{s.answered}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </>
  )
}
