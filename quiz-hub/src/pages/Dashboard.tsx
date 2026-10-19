import { GameCard, PageHeader, Section, StatCard } from '../components/ui'
import { formatDate } from '../lib/format'
import { bank } from '../games/quiz/bank'
import { describeKey, games } from '../games/registry'
import { recordKey } from '../games/types'
import { href } from '../lib/router'
import { useSave } from '../lib/store'
import { totals } from '../lib/storage'

export function Dashboard() {
  const { data } = useSave()
  const t = totals(data)

  return (
    <>
      <PageHeader
        title="Bienvenue, joueur 👾"
        subtitle="Testez votre culture générale, battez vos records."
        action={
          <a href={href('play', 'quiz', 'all')} className="btn-primary">
            ⚡ Partie rapide
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="🎯" label="Parties jouées" value={String(t.plays)} color="#8b5cf6" />
        <StatCard icon="✅" label="Bonnes réponses" value={String(t.correct)} color="#10b981" />
        <StatCard icon="📈" label="Précision" value={`${t.accuracy}%`} color="#06b6d4" />
        <StatCard icon="🏆" label="Meilleur score" value={String(t.best)} color="#f59e0b" />
      </div>

      <Section title="Jeux">
        <div className="grid gap-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      </Section>

      <Section title="Catégories">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {bank.categories.map((c) => {
            const count = bank.questions.filter((q) => q.category === c.id).length
            const best = data.records[recordKey('quiz', c.id)]?.best
            return (
              <a
                key={c.id}
                href={href('play', 'quiz', c.id)}
                className="card group p-5 transition hover:-translate-y-1"
                style={{ boxShadow: `inset 0 1px 0 ${c.color}55` }}
              >
                <span className="text-3xl transition group-hover:scale-110 inline-block">{c.icon}</span>
                <p className="mt-3 font-bold">{c.label}</p>
                <p className="text-xs text-slate-400">{count} questions</p>
                <p className="mt-3 text-xs font-semibold" style={{ color: c.color }}>
                  {best !== undefined ? `Record : ${best}` : 'Pas encore joué'}
                </p>
              </a>
            )
          })}
        </div>
      </Section>

      <Section title="Activité récente">
        {data.history.length === 0 ? (
          <p className="card p-6 text-slate-400">Aucune partie pour l’instant. Lancez une partie rapide !</p>
        ) : (
          <ul className="card divide-y divide-white/5">
            {data.history.slice(0, 5).map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{describeKey(s.key).label}</p>
                  <p className="text-xs text-slate-400">{formatDate(s.date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-violet-300">{s.score} pts</p>
                  <p className="text-xs text-slate-400">
                    {s.correct}/{s.total}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
