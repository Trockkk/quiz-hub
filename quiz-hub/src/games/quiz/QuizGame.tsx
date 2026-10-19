import { useEffect, useState } from 'react'
import { recordSession, useSave } from '../../lib/store'
import type { GameProps } from '../types'
import { bank } from './bank'
import { buildRound, pointsFor } from './logic'
import { QuizResults, type Answer } from './QuizResults'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function QuizGame(props: GameProps) {
  const [attempt, setAttempt] = useState(0)
  // A new key remounts the round: fresh questions, timer and settings.
  return <QuizRound key={attempt} {...props} onReplay={() => setAttempt((a) => a + 1)} />
}

function QuizRound({ recordKey, modeId, onExit, onReplay }: GameProps & { onReplay: () => void }) {
  const { data } = useSave()
  const [settings] = useState(data.settings) // frozen for the whole round
  const totalMs = settings.secondsPerQuestion * 1000
  const [round] = useState(() =>
    buildRound(modeId === 'all' ? bank.questions : bank.questions.filter((q) => q.category === modeId), settings.questionCount),
  )
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [deadline, setDeadline] = useState(() => Date.now() + totalMs)
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<{ isRecord: boolean; previousBest: number } | null>(null)

  const q = round[index]
  const current = answers[index]
  const revealed = current !== undefined

  // Countdown: ticks until the question is answered; a timeout counts as a wrong answer.
  useEffect(() => {
    if (revealed || result) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline) setAnswers((a) => (a.length > index ? a : [...a, { choice: null, correct: false, points: 0 }]))
    }, 100)
    return () => clearInterval(id)
  }, [revealed, result, deadline, index])

  const answer = (choice: number) => {
    const correct = choice === q.answer
    const points = pointsFor(correct, deadline - Date.now(), totalMs)
    setAnswers((a) => (a.length > index ? a : [...a, { choice, correct, points }]))
  }

  // Keys 1-4 answer; Enter on the auto-focused "next" button continues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (!revealed && !result && q && Number.isInteger(n) && n >= 1 && n <= q.choices.length) answer(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const score = answers.reduce((s, a) => s + a.points, 0)

  const next = () => {
    if (index + 1 < round.length) {
      const t = Date.now()
      setIndex(index + 1)
      setDeadline(t + totalMs)
      setNow(t)
      return
    }
    if (result) return
    const previousBest = data.records[recordKey]?.best ?? 0
    const isRecord = recordSession({
      key: recordKey,
      score,
      correct: answers.filter((a) => a.correct).length,
      total: round.length,
      date: new Date().toISOString(),
    })
    setResult({ isRecord, previousBest })
  }

  if (round.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Aucune question disponible pour cette catégorie.</p>
        <button className="btn-primary mt-6" onClick={onExit}>Retour</button>
      </div>
    )
  }

  if (result) {
    return <QuizResults round={round} answers={answers} score={score} {...result} onReplay={onReplay} onExit={onExit} />
  }

  const remaining = Math.max(0, deadline - now)
  const ratio = remaining / totalMs
  const barColor = ratio > 0.5 ? 'bg-violet-400' : ratio > 0.25 ? 'bg-amber-400' : 'bg-rose-500'
  const category = bank.categories.find((c) => c.id === q.category)

  return (
    <div className="mx-auto max-w-3xl animate-pop">
      <div className="mb-4 flex items-center justify-between gap-4 text-sm">
        <button onClick={onExit} className="rounded-lg px-3 py-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white">
          ← Quitter
        </button>
        <span className="font-medium text-slate-400">
          Question <span className="text-white">{index + 1}</span> / {round.length}
        </span>
        <span className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold tabular-nums">
          <span className="text-violet-300">{score}</span> pts
        </span>
      </div>

      <div className="mb-6 flex gap-1.5" aria-hidden>
        {round.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < answers.length ? (answers[i].correct ? 'bg-emerald-400' : 'bg-rose-500') : i === index ? 'bg-white/40' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="h-1.5 bg-white/5">
          <div className={`h-full ${barColor} transition-[width] duration-100 ease-linear`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            {category && (
              <span className="chip" style={{ color: category.color, borderColor: category.color + '55' }}>
                {category.icon} {category.label}
              </span>
            )}
            <span
              className={`ml-auto font-mono text-lg font-bold tabular-nums ${ratio > 0.25 ? 'text-slate-200' : 'text-rose-400'}`}
              aria-label={`${Math.ceil(remaining / 1000)} secondes restantes`}
            >
              {(remaining / 1000).toFixed(1)}s
            </span>
          </div>

          <h2 className="text-xl font-bold leading-snug sm:text-2xl">{q.question}</h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.choices.map((choice, i) => {
              const state = !revealed
                ? 'border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-violet-400/60 hover:bg-violet-500/10'
                : i === q.answer
                  ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-50'
                  : i === current.choice
                    ? 'border-rose-400/70 bg-rose-500/15 text-rose-50'
                    : 'border-white/5 opacity-40'
              return (
                <button
                  key={i}
                  disabled={revealed}
                  onClick={() => answer(i)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left font-medium transition ${state}`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold">{LETTERS[i]}</span>
                  {choice}
                </button>
              )
            })}
          </div>

          {revealed && (
            <div className="mt-6 animate-pop" aria-live="polite">
              <div
                className={`rounded-xl border p-4 ${current.correct ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'}`}
              >
                <p className="font-bold">
                  {current.correct ? `✅ Bonne réponse ! +${current.points} pts` : current.choice === null ? '⏱️ Temps écoulé !' : '❌ Mauvaise réponse'}
                </p>
                {!current.correct && (
                  <p className="mt-1 text-sm text-slate-300">
                    La bonne réponse était : <strong className="text-white">{q.choices[q.answer]}</strong>
                  </p>
                )}
                {q.explanation && <p className="mt-2 text-sm text-slate-300">{q.explanation}</p>}
              </div>
              <button autoFocus className="btn-primary mt-4 w-full sm:w-auto" onClick={next}>
                {index + 1 < round.length ? 'Question suivante →' : 'Voir les résultats 🏁'}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 hidden text-center text-xs text-slate-500 sm:block">Astuce : touches 1 à {q.choices.length} pour répondre, Entrée pour continuer.</p>
    </div>
  )
}
