import { BASE_POINTS, MAX_SPEED_BONUS, type Question } from './logic'

export interface Answer {
  /** null when the timer ran out */
  choice: number | null
  correct: boolean
  points: number
}

interface Props {
  round: Question[]
  answers: Answer[]
  score: number
  isRecord: boolean
  previousBest: number
  onReplay: () => void
  onExit: () => void
}

export function QuizResults({ round, answers, score, isRecord, previousBest, onReplay, onExit }: Props) {
  const correct = answers.filter((a) => a.correct).length
  const accuracy = Math.round((correct / round.length) * 100)
  const maxScore = round.length * (BASE_POINTS + MAX_SPEED_BONUS)
  const verdict = accuracy === 100 ? 'Parfait !' : accuracy >= 70 ? 'Excellent !' : accuracy >= 40 ? 'Pas mal !' : 'Continuez à vous entraîner !'

  return (
    <div className="mx-auto max-w-3xl animate-pop">
      <div className="card relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.35),transparent_60%)]" />
        <div className="relative">
          {isRecord && <span className="chip mb-4 border-amber-400/50 text-amber-300">🏆 Nouveau record personnel !</span>}
          <p className="text-sm font-medium uppercase tracking-widest text-slate-400">{verdict}</p>
          <p className="mt-2 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-6xl font-extrabold tabular-nums text-transparent sm:text-7xl">
            {score}
          </p>
          <p className="text-sm text-slate-400">sur {maxScore} points possibles</p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <Stat label="Bonnes réponses" value={`${correct}/${round.length}`} />
            <Stat label="Précision" value={`${accuracy}%`} />
            <Stat label="Record" value={String(Math.max(previousBest, score))} />
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button autoFocus className="btn-primary" onClick={onReplay}>🔄 Rejouer</button>
            <button className="btn-ghost" onClick={onExit}>Retour au hub</button>
          </div>
        </div>
      </div>

      <h3 className="mb-3 mt-10 text-lg font-bold">Correction</h3>
      <ol className="space-y-3">
        {round.map((q, i) => {
          const a = answers[i]
          return (
            <li key={q.id} className={`card border-l-4 p-4 ${a.correct ? 'border-l-emerald-400' : 'border-l-rose-500'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">
                  {i + 1}. {q.question}
                </p>
                <span className={`shrink-0 text-sm font-bold tabular-nums ${a.correct ? 'text-emerald-300' : 'text-rose-400'}`}>+{a.points}</span>
              </div>
              <p className="mt-2 text-sm">
                <span className="text-slate-400">Votre réponse : </span>
                <span className={a.correct ? 'text-emerald-300' : 'text-rose-300'}>{a.choice === null ? 'Temps écoulé' : q.choices[a.choice]}</span>
                {!a.correct && (
                  <>
                    <span className="text-slate-400"> · Bonne réponse : </span>
                    <span className="text-emerald-300">{q.choices[q.answer]}</span>
                  </>
                )}
              </p>
              {q.explanation && <p className="mt-1 text-sm text-slate-400">{q.explanation}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
