import { useCallback, useEffect, useRef, useState } from 'react'
import { PORTALS, configKey, rulesFor } from '../core/catalog'
import { answer, correctAnswer, current, gameDeadline, gridOf, next, questionDeadline, secure, start, stop, summarize, timeUp, timeoutResponse, type EngineState } from '../core/engine'
import { LADDER } from '../core/scoring'
import { DIFFICULTY_LABELS, type Challenge, type Config, type GameMeta, type Response } from '../core/types'
import { describeConfig } from '../lib/format'
import { recordSession, type RecordResult } from '../lib/store'
import { THEMES } from '../content/index'
import { Media } from './Media'
import { Results } from './Results'
import { ChallengeView } from './views'

interface Props {
  game: GameMeta
  config: Config
  challenges: Challenge[]
  /** daily challenge: the UTC day it belongs to */
  day?: string
  onReplay: () => void
  onExit: () => void
}

const fmtClock = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}`
}

export function GameRunner({ game, config, challenges, day, onReplay, onExit }: Props) {
  const rules = rulesFor(game, config)
  const [s, setS] = useState<EngineState>(() => start(challenges, { config, rules, now: Date.now() }))
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<RecordResult | null>(null)
  const draft = useRef<Response | null>(null)
  const recorded = useRef(false)
  const setDraft = useCallback((r: Response | null) => {
    draft.current = r
  }, [])
  const over = s.phase === 'over'

  // Clock: question timeout and whole-game timeout.
  useEffect(() => {
    if (over) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setS((prev) => {
        const gd = gameDeadline(prev, config)
        if (gd !== null && t >= gd) return timeUp(prev)
        const qd = questionDeadline(prev, config)
        const ch = current(prev)
        if (prev.phase === 'question' && ch && qd !== null && t >= qd) return answer(prev, timeoutResponse(ch, draft.current), { config, rules, now: t })
        return prev
      })
    }, 100)
    return () => clearInterval(id)
  }, [over, config, rules])

  useEffect(() => {
    draft.current = null
  }, [s.index])

  // Explanations off: short feedback, then the next question comes automatically.
  const lastTurn = s.turns.at(-1)
  useEffect(() => {
    if (s.phase !== 'feedback' || config.explanations) return
    const id = setTimeout(() => setS((p) => next(p, Date.now())), lastTurn?.grade.correct ? 700 : 1500)
    return () => clearTimeout(id)
  }, [s.phase, s.index, config.explanations, lastTurn])

  // Save the result once, when the game ends.
  useEffect(() => {
    if (!over || recorded.current || s.turns.length === 0) return
    recorded.current = true
    const sum = summarize(s)
    setResult(
      recordSession(
        {
          key: day ? `daily|${configKey(game, config)}` : configKey(game, config),
          gameId: game.id,
          portal: game.portal,
          score: sum.score,
          correct: sum.correct,
          answered: sum.answered,
          avgMs: sum.avgMs,
          timeMs: sum.timeMs,
          bestStreak: sum.bestStreak,
          d: config.difficulty,
          date: new Date().toISOString(),
          label: describeConfig(game, config),
          perTheme: sum.perTheme,
          seen: sum.seen,
        },
        day ? { day, grid: gridOf(s) } : undefined,
      ),
    )
  }, [over, s, game, config, day])

  const submit = (r: Response) => setS((p) => answer(p, r, { config, rules, now: Date.now() }))
  const goNext = () => setS((p) => next(p, Date.now()))

  if (over) {
    return <Results game={game} config={config} state={s} result={result} day={day} onReplay={onReplay} onExit={onExit} />
  }

  const ch = current(s)!
  const turn = s.phase === 'feedback' ? lastTurn! : null
  const qd = questionDeadline(s, config)
  const gd = gameDeadline(s, config)
  const qLeft = qd === null ? null : Math.max(0, qd - now)
  const gLeft = gd === null ? null : Math.max(0, gd - now)
  const ratio = qLeft === null || config.questionTime === null ? 1 : qLeft / (config.questionTime * 1000)
  const barColor = ratio > 0.5 ? 'bg-violet-400' : ratio > 0.25 ? 'bg-amber-400' : 'bg-rose-500'
  const portal = PORTALS.find((p) => p.id === game.portal)!
  const theme = THEMES.find((t) => t.id === ch.theme)
  const endless = config.count === 0 || game.engine.endOnError || rules.endOnError
  const elapsed = (turn ? turn.timeMs : now - s.questionStart)

  const quit = () => {
    if (s.turns.length === 0 || window.confirm('Abandonner la partie ? Elle ne sera pas enregistrée.')) onExit()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button onClick={quit} className="rounded-lg px-3 py-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white">← Quitter</button>
        <span className="font-medium text-slate-400">
          {game.icon} {game.title} · {endless ? <>Question <span className="text-white">{s.index + 1}</span></> : <>Question <span className="text-white">{s.index + 1}</span> / {s.challenges.length}</>}
        </span>
        <div className="flex items-center gap-2">
          {s.lives !== null && <span className="rounded-lg bg-white/5 px-2.5 py-1.5" aria-label={`${s.lives} vies`}>{'❤️'.repeat(s.lives)}{'🖤'.repeat(Math.max(0, (rules.lives ?? 0) - s.lives))}</span>}
          {s.streak >= 2 && <span className="animate-pop rounded-lg bg-orange-500/15 px-2.5 py-1.5 font-semibold text-orange-300">🔥 {s.streak}</span>}
          <span className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold tabular-nums"><span className="text-violet-300">{s.score.toLocaleString('fr-FR')}</span> pts</span>
        </div>
      </div>

      {gLeft !== null && (
        <div className="mb-4 flex items-center gap-3">
          <span className={`font-mono text-3xl font-extrabold tabular-nums ${gLeft < 10_000 ? 'text-rose-400' : 'text-white'}`} aria-label="Temps restant pour la partie">⏱ {fmtClock(gLeft)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-orange-400 to-rose-500 transition-[width] duration-100 ease-linear" style={{ width: `${(gLeft / ((config.totalTime ?? 1) * 1000)) * 100}%` }} />
          </div>
        </div>
      )}

      {!endless && (
        <div className="mb-5 flex gap-1" aria-hidden>
          {s.challenges.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < s.turns.length ? (s.turns[i].grade.correct ? 'bg-emerald-400' : s.turns[i].grade.ratio > 0 ? 'bg-amber-400' : 'bg-rose-500') : i === s.index ? 'bg-white/40' : 'bg-white/10'}`} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {s.ladder && (
          <aside className="card order-2 shrink-0 p-3 lg:order-none lg:w-44" aria-label="Paliers">
            <ol className="flex flex-col-reverse gap-1 text-sm">
              {LADDER.map((v, i) => {
                const reached = s.turns.filter((t) => t.grade.correct).length
                const isNow = i === reached
                return (
                  <li key={v} className={`flex justify-between rounded-md px-2 py-1 tabular-nums ${isNow ? 'bg-violet-500/30 font-bold text-white' : i < reached ? 'text-emerald-300' : 'text-slate-500'}`}>
                    <span>{i + 1}</span>
                    <span>{v.toLocaleString('fr-FR')}{s.ladder!.secured === v && ' 🔒'}</span>
                  </li>
                )
              })}
            </ol>
          </aside>
        )}

        <div key={s.index} className="card min-w-0 flex-1 animate-pop overflow-hidden">
          <div className="h-1.5 bg-white/5">
            {qLeft !== null && <div className={`h-full ${barColor} transition-[width] duration-100 ease-linear`} style={{ width: `${ratio * 100}%` }} />}
          </div>
          <div className="p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {theme && <span className="chip" style={{ color: theme.color, borderColor: theme.color + '55' }}>{theme.icon} {theme.label}</span>}
              <span className="chip" style={{ color: portal.color }}>{DIFFICULTY_LABELS[ch.d]}</span>
              {qLeft !== null && !turn && (
                <span className={`ml-auto font-mono text-lg font-bold tabular-nums ${ratio > 0.25 ? 'text-slate-200' : 'text-rose-400'}`} aria-label={`${Math.ceil(qLeft / 1000)} secondes restantes`}>
                  {(qLeft / 1000).toFixed(1)} s
                </span>
              )}
              {qLeft === null && !turn && <span className="ml-auto text-xs text-slate-500">⏳ Temps illimité</span>}
            </div>

            <h2 className="text-xl font-bold leading-snug sm:text-2xl">{ch.prompt}</h2>
            {ch.media && (
              <div className="my-5 flex justify-center">
                <Media media={ch.media} elapsedMs={elapsed} revealMs={(config.questionTime ?? 15) * 1000} done={!!turn} />
              </div>
            )}
            <div className="mt-5">
              <ChallengeView key={ch.id} ch={ch} turn={turn} config={config} onSubmit={submit} setDraft={setDraft} />
            </div>

            {s.ladder && !turn && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                <button className="btn-ghost text-sm" disabled={s.ladder.securesLeft === 0 || s.score <= s.ladder.secured} onClick={() => setS(secure)}>
                  🔒 Sécuriser {s.score.toLocaleString('fr-FR')} pts ({s.ladder.securesLeft} restant{s.ladder.securesLeft > 1 ? 's' : ''})
                </button>
                <button className="btn-ghost text-sm" disabled={s.turns.length === 0} onClick={() => setS(stop)}>
                  🏳️ M'arrêter avec {s.score.toLocaleString('fr-FR')} pts
                </button>
              </div>
            )}

            {turn && <Feedback turn={turn} config={config} pendingEnd={s.pendingEnd} last={s.index + 1 >= s.challenges.length} onNext={goNext} ladder={!!s.ladder} />}
          </div>
        </div>
      </div>
      <p className="mt-4 hidden text-center text-xs text-slate-500 sm:block">Astuce : touches 1 à 4 pour les propositions, Entrée pour valider et continuer.</p>
    </div>
  )
}

function Feedback({ turn, config, pendingEnd, last, onNext, ladder }: { turn: EngineState['turns'][number]; config: Config; pendingEnd: string | null; last: boolean; onNext: () => void; ladder: boolean }) {
  const { grade: g, points, challenge: ch, response } = turn
  const answerText = correctAnswer(ch)
  const verdict = response === null && !g.correct ? '⏱️ Temps écoulé !' : g.correct ? (g.ratio < 1 ? '✅ Correct' : '✅ Bonne réponse !') : g.ratio > 0 ? '🟨 Partiellement juste' : '❌ Raté'
  const showDetails = config.explanations
  return (
    <div className="mt-6 animate-pop" aria-live="polite">
      <div className={`rounded-xl border p-4 ${g.correct ? 'border-emerald-400/30 bg-emerald-500/10' : g.ratio > 0 ? 'border-amber-400/30 bg-amber-500/10' : 'border-rose-400/30 bg-rose-500/10'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">{verdict}</p>
          <p className="text-sm font-bold tabular-nums">
            {ladder ? (points.total > 0 ? `Palier atteint : ${points.total.toLocaleString('fr-FR')} pts de plus` : '') : `+${points.total} pts`}
            {!ladder && points.speed > 0 && <span className="ml-2 font-normal text-sky-300">dont ⚡ {points.speed}</span>}
            {!ladder && points.streak > 0 && <span className="ml-2 font-normal text-orange-300">dont 🔥 {points.streak}</span>}
          </p>
        </div>
        {!g.correct && answerText && <p className="mt-1 text-sm text-slate-300">La bonne réponse était : <strong className="text-white">{answerText}</strong></p>}
        {showDetails && ch.explanation && <p className="mt-2 text-sm text-slate-300">{ch.explanation}</p>}
        {showDetails && ch.source && <p className="mt-1 text-xs text-slate-500">Source : {ch.source}</p>}
      </div>
      {showDetails && (
        <button autoFocus className="btn-primary mt-4 w-full sm:w-auto" onClick={onNext}>
          {pendingEnd ? 'Voir les résultats' : last ? 'Voir les résultats 🏁' : 'Question suivante →'}
        </button>
      )}
    </div>
  )
}
