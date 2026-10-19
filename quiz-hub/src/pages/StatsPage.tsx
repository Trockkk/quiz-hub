import { PageHeader, Section, StatCard } from '../components/ui'
import { formatDate } from '../lib/format'
import { describeKey } from '../games/registry'
import { useSave } from '../lib/store'
import { totals } from '../lib/storage'

export function StatsPage() {
  const { data } = useSave()
  const t = totals(data)
  const maxScore = Math.max(1, ...data.history.map((h) => h.score))
  const records = Object.entries(data.records).sort((a, b) => b[1].best - a[1].best)

  return (
    <>
      <PageHeader title="Statistiques" subtitle="Vos records personnels et votre historique." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="🎯" label="Parties jouées" value={String(t.plays)} color="#8b5cf6" />
        <StatCard icon="✅" label="Bonnes réponses" value={String(t.correct)} color="#10b981" />
        <StatCard icon="📈" label="Précision globale" value={`${t.accuracy}%`} color="#06b6d4" />
        <StatCard icon="🏅" label="Modes joués" value={String(records.length)} color="#f59e0b" />
      </div>

      <Section title="Records personnels">
        {records.length === 0 ? (
          <p className="card p-6 text-slate-400">Jouez une partie pour établir votre premier record.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Mode</th>
                  <th className="px-5 py-3 font-semibold">Record</th>
                  <th className="px-5 py-3 font-semibold">Parties</th>
                  <th className="px-5 py-3 font-semibold">Précision</th>
                  <th className="px-5 py-3 font-semibold">Dernière partie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map(([key, r], i) => (
                  <tr key={key}>
                    <td className="px-5 py-3 font-medium">
                      {i === 0 && '👑 '}
                      {describeKey(key).label}
                    </td>
                    <td className="px-5 py-3 font-bold tabular-nums text-amber-300">{r.best}</td>
                    <td className="px-5 py-3 tabular-nums">{r.plays}</td>
                    <td className="px-5 py-3 tabular-nums">{r.totalAnswered ? Math.round((r.totalCorrect / r.totalAnswered) * 100) : 0}%</td>
                    <td className="px-5 py-3 text-slate-400">{formatDate(r.lastPlayed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Dernières parties">
        {data.history.length === 0 ? (
          <p className="card p-6 text-slate-400">Aucune partie enregistrée.</p>
        ) : (
          <div className="card p-5">
            {/* Bars: score of the last games, oldest on the left. */}
            <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Scores des dernières parties">
              {[...data.history].reverse().map((s, i) => (
                <div
                  key={i}
                  title={`${describeKey(s.key).label} — ${s.score} pts`}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-400 opacity-80 transition hover:opacity-100"
                  style={{ height: `${Math.max(4, (s.score / maxScore) * 100)}%` }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">{data.history.length} dernières parties (au maximum 30 conservées)</p>
          </div>
        )}
      </Section>
    </>
  )
}
