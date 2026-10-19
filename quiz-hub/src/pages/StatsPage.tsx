import { GAMES, PORTALS } from '../core/catalog'
import { DIFFICULTY_LABELS, type Difficulty } from '../core/types'
import { THEMES } from '../content/index'
import { Empty, PageHeader, Section, StatCard } from '../components/ui'
import { ACHIEVEMENTS } from '../lib/achievements'
import { fmtMs, formatDate } from '../lib/format'
import { accuracy, type Agg } from '../lib/storage'
import { useSave } from '../lib/store'

function Bar({ label, agg, color }: { label: string; agg?: Agg; color: string }) {
  const acc = accuracy(agg)
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 shrink-0 truncate text-slate-300">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${acc}%`, background: color }} />
      </div>
      <span className="w-28 shrink-0 text-right tabular-nums text-slate-400">{agg ? `${acc} % · ${agg.plays} p.` : '—'}</span>
    </div>
  )
}

export function StatsPage() {
  const { data } = useSave()
  const all = data.stats.all
  const records = Object.entries(data.records).sort((a, b) => b[1].lastPlayed.localeCompare(a[1].lastPlayed))
  const history = data.history.slice(0, 30)
  const maxScore = Math.max(1, ...history.map((h) => h.score))
  const gameOf = (key: string) => GAMES.find((g) => g.id === key.split('|')[0] || (key.startsWith('daily|') && g.id === 'daily'))

  return (
    <>
      <PageHeader title="Statistiques" subtitle="Vos données restent dans ce navigateur, sur cet appareil." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon="🎯" label="Parties jouées" value={String(all?.plays ?? 0)} color="#8b5cf6" />
        <StatCard icon="📈" label="Précision" value={`${accuracy(all)} %`} color="#06b6d4" />
        <StatCard icon="⏱️" label="Temps moyen / réponse" value={all?.answered ? fmtMs(all.timeMs / all.answered) : '—'} color="#10b981" />
        <StatCard icon="🔥" label="Meilleure série" value={String(all?.bestStreak ?? 0)} color="#f97316" />
        <StatCard icon="📅" label="Série de défis du jour" value={`${data.daily.streak} (max ${data.daily.best})`} color="#ec4899" />
      </div>

      {!all ? (
        <div className="mt-10"><Empty>Jouez une première partie pour voir vos statistiques.</Empty></div>
      ) : (
        <>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="card space-y-3 p-5">
              <h2 className="mb-2 font-bold">Par catégorie</h2>
              {PORTALS.map((p) => <Bar key={p.id} label={`${p.icon} ${p.title}`} agg={data.stats[`portal:${p.id}`]} color={p.color} />)}
            </div>
            <div className="space-y-6">
              <div className="card space-y-3 p-5">
                <h2 className="mb-2 font-bold">Par difficulté</h2>
                {([1, 2, 3, 4] as Difficulty[]).map((d) => <Bar key={d} label={DIFFICULTY_LABELS[d]} agg={data.stats[`diff:${d}`]} color={['', '#10b981', '#06b6d4', '#f59e0b', '#ef4444'][d]} />)}
              </div>
              <div className="card space-y-3 p-5">
                <h2 className="mb-2 font-bold">Par thème (culture G)</h2>
                {THEMES.map((t) => <Bar key={t.id} label={`${t.icon} ${t.label}`} agg={data.stats[`theme:${t.id}`]} color={t.color} />)}
              </div>
            </div>
          </div>

          <Section title="Dernières parties">
            <div className="card p-5">
              <div className="flex h-36 items-end gap-1" role="img" aria-label="Scores des dernières parties">
                {[...history].reverse().map((s, i) => (
                  <div key={i} title={`${GAMES.find((g) => g.id === s.gameId)?.title ?? s.gameId} — ${s.score} pts`}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-400 opacity-80 transition hover:opacity-100"
                    style={{ height: `${Math.max(4, (s.score / maxScore) * 100)}%` }} />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Les scores ne sont comparables qu'à paramètres identiques (voir les records).</p>
            </div>
            <ul className="card mt-4 divide-y divide-white/5">
              {history.slice(0, 10).map((s, i) => {
                const g = GAMES.find((x) => x.id === s.gameId)
                return (
                  <li key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g?.icon} {g?.title ?? s.gameId}</p>
                      <p className="truncate text-xs text-slate-400">{formatDate(s.date)} · {s.label}</p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p className="font-bold text-violet-300">{s.score.toLocaleString('fr-FR')} pts</p>
                      <p className="text-xs text-slate-400">{s.correct}/{s.answered} · {s.avgMs ? fmtMs(s.avgMs) : '—'} · 🔥{s.bestStreak}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>

          <Section title="Records personnels (par jeu et par paramètres)">
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Jeu</th>
                    <th className="px-4 py-3 font-semibold">Paramètres</th>
                    <th className="px-4 py-3 font-semibold">Record</th>
                    <th className="px-4 py-3 font-semibold">Parties</th>
                    <th className="px-4 py-3 font-semibold">Série</th>
                    <th className="px-4 py-3 font-semibold">Dernière</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {records.map(([key, r]) => {
                    const g = gameOf(key)
                    return (
                      <tr key={key}>
                        <td className="px-4 py-3 font-medium">{g?.icon} {g?.title ?? key.split('|')[0]}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{r.label}</td>
                        <td className="px-4 py-3 font-bold tabular-nums text-amber-300">{r.best.toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 tabular-nums">{r.plays}</td>
                        <td className="px-4 py-3 tabular-nums">{r.bestStreak}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(r.lastPlayed)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      <Section title={`Succès (${Object.keys(data.achievements).length}/${ACHIEVEMENTS.length})`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const date = data.achievements[a.id]
            return (
              <div key={a.id} className={`card flex items-center gap-4 p-4 ${date ? '' : 'opacity-50 grayscale'}`}>
                <span className="text-3xl">{a.icon}</span>
                <div>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-xs text-slate-400">{a.description}</p>
                  {date && <p className="mt-1 text-xs text-amber-300">Débloqué le {formatDate(date)}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </Section>
    </>
  )
}
