import { useEffect, useRef, useState } from 'react'
import { configKey } from '../core/catalog'
import { DIFF_MULT } from '../core/scoring'
import type { Config, Difficulty, GameMeta } from '../core/types'
import { describeConfig } from '../lib/format'
import { recordSession, type RecordResult } from '../lib/store'
import { EndCard } from './EndCard'

const SETS: Record<string, string[]> = {
  symbols: ['🍎', '⭐', '🐱', '🚀', '🎵', '⚽', '🌙', '🔥', '💎'],
  numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#f97316'],
}
const PAD: Record<Difficulty, number> = { 1: 4, 2: 6, 3: 8, 4: 9 }
const SHOW_MS: Record<Difficulty, number> = { 1: 900, 2: 700, 3: 520, 4: 380 }
const START_LEN: Record<Difficulty, number> = { 1: 3, 2: 3, 3: 4, 4: 5 }
const LIVES = 3

type Phase = 'ready' | 'show' | 'input' | 'win' | 'fail' | 'over'

export function Memory({ game, config, onReplay, onExit }: { game: GameMeta; config: Config; onReplay: () => void; onExit: () => void }) {
  const d = config.difficulty
  const symbols = SETS[config.variant] ?? SETS.symbols
  const pad = symbols.slice(0, PAD[d])
  const [phase, setPhase] = useState<Phase>('ready')
  const [len, setLen] = useState(START_LEN[d])
  const [seq, setSeq] = useState<number[]>([])
  const [shown, setShown] = useState(-1)
  const [input, setInput] = useState<number[]>([])
  const [lives, setLives] = useState(LIVES)
  const [stats, setStats] = useState({ score: 0, rounds: 0, won: 0, streak: 0, bestStreak: 0, best: 0, timeMs: 0 })
  const [result, setResult] = useState<RecordResult | null>(null)
  const inputStart = useRef(0)

  const newRound = (length: number) => {
    setSeq(Array.from({ length }, () => Math.floor(Math.random() * pad.length)))
    setInput([])
    setShown(-1)
    setPhase('show')
  }

  // Show the sequence one item at a time.
  useEffect(() => {
    if (phase !== 'show') return
    if (shown >= seq.length) {
      inputStart.current = Date.now()
      setPhase('input')
      return
    }
    const id = setTimeout(() => setShown((s) => s + 1), shown < 0 ? 600 : SHOW_MS[d])
    return () => clearTimeout(id)
  }, [phase, shown, seq.length, d])

  const press = (i: number) => {
    if (phase !== 'input') return
    const nextInput = [...input, i]
    setInput(nextInput)
    const pos = nextInput.length - 1
    const elapsed = Date.now() - inputStart.current
    if (seq[pos] !== i) {
      setStats((s) => ({ ...s, rounds: s.rounds + 1, streak: 0, timeMs: s.timeMs + elapsed }))
      setLives((l) => l - 1)
      setPhase(lives - 1 <= 0 ? 'over' : 'fail')
      return
    }
    if (nextInput.length === seq.length) {
      setStats((s) => {
        const streak = s.streak + 1
        return { score: s.score + Math.round(10 * seq.length * DIFF_MULT[d]), rounds: s.rounds + 1, won: s.won + 1, streak, bestStreak: Math.max(s.bestStreak, streak), best: Math.max(s.best, seq.length), timeMs: s.timeMs + elapsed }
      })
      setPhase('win')
    }
  }

  // Between rounds: longer after a success, same length after a failure.
  useEffect(() => {
    if (phase !== 'win' && phase !== 'fail') return
    const nextLen = phase === 'win' ? len + 1 : len
    const id = setTimeout(() => {
      setLen(nextLen)
      newRound(nextLen)
    }, 900)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'over' || result) return
    setResult(
      recordSession({
        key: configKey(game, config), gameId: game.id, portal: game.portal, score: stats.score, correct: stats.won, answered: stats.rounds,
        avgMs: stats.rounds ? Math.round(stats.timeMs / stats.rounds) : 0, timeMs: stats.timeMs, bestStreak: stats.bestStreak, d,
        date: new Date().toISOString(), label: describeConfig(game, config), perTheme: {}, seen: [],
      }),
    )
  }, [phase, result, stats, game, config, d])

  const cell = (i: number, active: boolean, big = false) => {
    const sym = pad[i]
    const isColor = config.variant === 'colors'
    return (
      <span
        className={`grid place-items-center rounded-2xl font-bold transition ${big ? 'size-28 text-6xl' : 'size-16 text-3xl sm:size-20'} ${active ? 'scale-105 ring-4 ring-white' : ''}`}
        style={isColor ? { background: sym, opacity: active || !big ? 1 : 0.25 } : undefined}
      >
        {isColor ? '' : sym}
      </span>
    )
  }

  if (phase === 'over') {
    return (
      <EndCard game={game} config={config} score={stats.score} result={result} onReplay={onReplay} onExit={onExit}
        stats={[['Manches réussies', `${stats.won}/${stats.rounds}`], ['Plus longue séquence', String(stats.best)], ['Meilleure série', `🔥 ${stats.bestStreak}`], ['Niveau', `${PAD[d]} symboles`]]} />
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between text-sm">
        <button onClick={onExit} className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white">← Quitter</button>
        <span>{'❤️'.repeat(lives)}{'🖤'.repeat(LIVES - lives)}</span>
        <span className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold tabular-nums"><span className="text-violet-300">{stats.score}</span> pts</span>
      </div>
      <div className="card p-6 text-center sm:p-8">
        {phase === 'ready' ? (
          <>
            <p className="text-5xl">🧠</p>
            <h2 className="mt-4 text-2xl font-bold">Prêt à mémoriser ?</h2>
            <p className="mt-2 text-slate-400">Une séquence de {len} éléments va s'afficher. Reproduisez-la ensuite dans le même ordre.</p>
            <button autoFocus className="btn-primary mt-6" onClick={() => newRound(len)}>Commencer</button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-400">
              Séquence de {len} · {phase === 'show' ? 'Mémorisez…' : phase === 'input' ? `À vous ! (${input.length}/${seq.length})` : phase === 'win' ? '✅ Bravo !' : '❌ Raté…'}
            </p>
            <div className="my-6 grid h-32 place-items-center" aria-live="polite">
              {phase === 'show' && shown >= 0 && shown < seq.length ? <span key={shown} className="animate-pop">{cell(seq[shown], true, true)}</span> : <span className="text-slate-600">•••</span>}
            </div>
            <div className="mx-auto grid w-fit grid-cols-3 gap-3">
              {pad.map((_, i) => (
                <button key={i} disabled={phase !== 'input'} onClick={() => press(i)} aria-label={config.variant === 'colors' ? `Couleur ${i + 1}` : pad[i]} className="rounded-2xl bg-white/5 p-1 transition hover:bg-white/10 active:scale-95 disabled:opacity-50">
                  {cell(i, false)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
