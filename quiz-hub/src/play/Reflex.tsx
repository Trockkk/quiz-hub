import { useEffect, useRef, useState } from 'react'
import { configKey } from '../core/catalog'
import { DIFF_MULT } from '../core/scoring'
import type { Config, Difficulty, GameMeta } from '../core/types'
import { describeConfig } from '../lib/format'
import { recordSession, type RecordResult } from '../lib/store'
import { EndCard } from './EndCard'

/** Time allowed to react once the signal shows. */
const WINDOW: Record<Difficulty, number> = { 1: 1500, 2: 1000, 3: 750, 4: 550 }
const DECOY_RATE: Record<Difficulty, number> = { 1: 0.2, 2: 0.25, 3: 0.3, 4: 0.35 }
const ARROWS = [
  { key: 'ArrowLeft', label: '←' },
  { key: 'ArrowRight', label: '→' },
  { key: 'ArrowUp', label: '↑' },
  { key: 'ArrowDown', label: '↓' },
]

type Signal = { kind: 'go' } | { kind: 'decoy' } | { kind: 'arrow'; dir: number }
type Phase = 'ready' | 'wait' | 'signal' | 'feedback' | 'over'

interface Trial {
  ok: boolean
  ms: number | null
  msg: string
}

export function Reflex({ game, config, onReplay, onExit }: { game: GameMeta; config: Config; onReplay: () => void; onExit: () => void }) {
  const d = config.difficulty
  const [phase, setPhase] = useState<Phase>('ready')
  const [signal, setSignal] = useState<Signal | null>(null)
  const [trials, setTrials] = useState<Trial[]>([])
  const [result, setResult] = useState<RecordResult | null>(null)
  const shownAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const arrows = ARROWS.slice(0, d >= 3 ? 4 : 2)

  const finishTrial = (t: Trial) => {
    clearTimeout(timer.current)
    setTrials((all) => [...all, t])
    setPhase('feedback')
  }

  const startTrial = () => {
    setSignal(null)
    setPhase('wait')
    timer.current = setTimeout(() => {
      const r = Math.random()
      const s: Signal =
        config.variant === 'choice' ? { kind: 'arrow', dir: Math.floor(Math.random() * arrows.length) }
        : config.variant === 'decoys' && r < DECOY_RATE[d] ? { kind: 'decoy' }
        : { kind: 'go' }
      setSignal(s)
      shownAt.current = performance.now()
      setPhase('signal')
      // Decoy ignored = success; real signal missed = failure.
      timer.current = setTimeout(
        () => finishTrial(s.kind === 'decoy' ? { ok: true, ms: null, msg: 'Bien vu, c’était un piège !' } : { ok: false, ms: null, msg: 'Trop lent !' }),
        s.kind === 'decoy' ? 900 : WINDOW[d],
      )
    }, 1200 + Math.random() * 2500)
  }

  const react = (dir?: number) => {
    if (phase === 'wait') return finishTrial({ ok: false, ms: null, msg: 'Trop tôt ! Attendez le signal.' })
    if (phase !== 'signal' || !signal) return
    const ms = Math.round(performance.now() - shownAt.current)
    if (signal.kind === 'decoy') return finishTrial({ ok: false, ms: null, msg: 'Piège ! Il ne fallait pas appuyer.' })
    if (signal.kind === 'arrow' && dir !== signal.dir) return finishTrial({ ok: false, ms: null, msg: 'Mauvaise direction !' })
    finishTrial({ ok: true, ms, msg: `${ms} ms` })
  }

  // Keyboard: space / enter, or arrows for the "choice" variant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'ready' || phase === 'feedback' || phase === 'over') return
      const a = arrows.findIndex((x) => x.key === e.key)
      if (a >= 0) {
        e.preventDefault()
        react(a)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (config.variant !== 'choice') react()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  // Next trial or end of game.
  useEffect(() => {
    if (phase !== 'feedback') return
    const id = setTimeout(() => (trials.length >= config.count ? setPhase('over') : startTrial()), 1100)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, trials.length])

  const hits = trials.filter((t) => t.ok)
  const timed = hits.filter((t) => t.ms !== null) as { ms: number }[]
  const avg = timed.length ? Math.round(timed.reduce((a, t) => a + t.ms, 0) / timed.length) : 0
  // Points: correct reactions count most, faster ones earn more.
  const score = Math.round(
    trials.reduce((a, t) => a + (t.ok ? 60 + (t.ms === null ? 40 : Math.max(0, 40 * (1 - t.ms / WINDOW[d]))) : 0), 0) * DIFF_MULT[d],
  )
  let streak = 0
  let bestStreak = 0
  for (const t of trials) {
    streak = t.ok ? streak + 1 : 0
    bestStreak = Math.max(bestStreak, streak)
  }

  useEffect(() => {
    if (phase !== 'over' || result) return
    setResult(
      recordSession({
        key: configKey(game, config), gameId: game.id, portal: game.portal, score, correct: hits.length, answered: trials.length, avgMs: avg,
        timeMs: timed.reduce((a, t) => a + t.ms, 0), bestStreak, d, date: new Date().toISOString(), label: describeConfig(game, config), perTheme: {}, seen: [],
      }),
    )
  }, [phase, result, game, config, score, hits.length, trials.length, avg, timed, bestStreak, d])

  if (phase === 'over') {
    return (
      <EndCard game={game} config={config} score={score} result={result} onReplay={onReplay} onExit={onExit}
        stats={[['Réussites', `${hits.length}/${trials.length}`], ['Temps moyen', avg ? `${avg} ms` : '—'], ['Meilleur temps', timed.length ? `${Math.min(...timed.map((t) => t.ms))} ms` : '—'], ['Meilleure série', `🔥 ${bestStreak}`]]} />
    )
  }

  const zone =
    phase === 'signal' && signal?.kind === 'go' ? 'bg-emerald-500 text-emerald-950'
    : phase === 'signal' && signal?.kind === 'decoy' ? 'bg-rose-600 text-white'
    : phase === 'signal' && signal?.kind === 'arrow' ? 'bg-sky-500 text-sky-950'
    : phase === 'feedback' ? (trials.at(-1)?.ok ? 'bg-emerald-900/60' : 'bg-rose-900/60')
    : 'bg-ink-800'

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm">
        <button onClick={onExit} className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white">← Quitter</button>
        <span className="text-slate-400">Essai {Math.min(trials.length + 1, config.count)} / {config.count}</span>
        <span className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold tabular-nums"><span className="text-violet-300">{score}</span> pts</span>
      </div>
      <button
        type="button"
        onPointerDown={() => (config.variant === 'choice' ? undefined : phase === 'ready' ? startTrial() : react())}
        className={`grid h-80 w-full select-none place-items-center rounded-3xl text-center shadow-2xl transition-colors duration-75 ${zone}`}
        aria-live="assertive"
      >
        {phase === 'ready' && (
          <span>
            <span className="block text-5xl">⚡</span>
            <span className="mt-3 block text-2xl font-bold">Touchez pour commencer</span>
            <span className="mt-2 block text-sm text-slate-400">
              {config.variant === 'choice' ? 'Appuyez sur la flèche affichée (clavier ou boutons).' : config.variant === 'decoys' ? 'Vert : appuyez. Rouge : surtout pas !' : 'Appuyez dès que l’écran devient vert.'}
            </span>
          </span>
        )}
        {phase === 'wait' && <span className="text-2xl font-bold text-slate-400">Attendez…</span>}
        {phase === 'signal' && signal?.kind === 'go' && <span className="text-5xl font-black">MAINTENANT !</span>}
        {phase === 'signal' && signal?.kind === 'decoy' && <span className="text-5xl font-black">STOP ✋</span>}
        {phase === 'signal' && signal?.kind === 'arrow' && <span className="text-8xl font-black">{arrows[signal.dir].label}</span>}
        {phase === 'feedback' && <span className="text-3xl font-bold">{trials.at(-1)?.msg}</span>}
      </button>
      {config.variant === 'choice' && phase !== 'ready' && (
        <div className="mt-4 flex justify-center gap-3">
          {arrows.map((a, i) => (
            <button key={a.key} onPointerDown={() => react(i)} className="btn-ghost size-16 text-3xl" aria-label={`Flèche ${a.label}`}>{a.label}</button>
          ))}
        </div>
      )}
      {config.variant === 'choice' && phase === 'ready' && (
        <div className="mt-4 text-center"><button className="btn-primary" onClick={startTrial}>Commencer</button></div>
      )}
    </div>
  )
}
