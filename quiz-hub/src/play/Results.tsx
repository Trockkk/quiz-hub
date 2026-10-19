import { useState } from 'react'
import { correctAnswer, gridOf, summarize, type EngineState } from '../core/engine'
import { bossRank } from '../core/games/special'
import { DIFF_MULT, LADDER, MAX_SPEED_SHARE } from '../core/scoring'
import type { Config, GameMeta } from '../core/types'
import { describeConfig, fmtMs } from '../lib/format'
import { href } from '../lib/router'
import type { RecordResult } from '../lib/store'

const END_LABELS = { done: 'Partie terminée', time: 'Temps écoulé', error: 'Fin de la série', lives: 'Le boss vous a terrassé', stopped: 'Vous vous êtes arrêté' }

interface Props {
  game: GameMeta
  config: Config
  state: EngineState
  result: RecordResult | null
  day?: string
  onReplay: () => void
  onExit: () => void
}

function responseText(t: EngineState['turns'][number]): string {
  const r = t.response
  if (!r) return 'Pas de réponse'
  switch (r.kind) {
    case 'mcq': return r.choice === null ? 'Pas de réponse' : t.challenge.kind === 'mcq' ? t.challenge.choices[r.choice] : ''
    case 'text': return r.text ?? '—'
    case 'estimate': return r.value === null ? '—' : r.value.toLocaleString('fr-FR')
    case 'rare': return r.text ?? '—'
    case 'list': return `${r.found.length} réponse${r.found.length > 1 ? 's' : ''}`
    case 'order': return `${Math.round(t.grade.ratio * 100)} % de paires bien placées`
    case 'connections': return `${r.solved} groupe${r.solved > 1 ? 's' : ''}, ${r.mistakes} erreur${r.mistakes > 1 ? 's' : ''}`
  }
}

export function Results({ game, config, state, result, day, onReplay, onExit }: Props) {
  const sum = summarize(state)
  const [copied, setCopied] = useState(false)
  const acc = sum.answered ? Math.round((sum.correct / sum.answered) * 100) : 0
  const maxPossible = state.ladder ? LADDER.at(-1)! : state.challenges.reduce((a, c) => a + Math.round(100 * DIFF_MULT[c.d] * (1 + MAX_SPEED_SHARE)), 0)
  const rank = game.id === 'boss' ? bossRank(sum.score / Math.max(1, maxPossible)) : null
  const verdict = sum.answered === 0 ? 'Aucune réponse' : acc === 100 ? 'Parfait !' : acc >= 70 ? 'Excellent !' : acc >= 40 ? 'Pas mal !' : 'Continuez à vous entraîner !'

  const share = async () => {
    const text = `Quiz Hub · Défi du ${day}\n${gridOf(state)}\n${sum.score} pts · ${sum.correct}/${sum.answered}\n${location.origin}${location.pathname}#/game/daily`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      window.prompt('Copiez votre résultat :', text)
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-pop">
      <div className="card relative overflow-hidden p-6 text-center sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.35),transparent_60%)]" />
        <div className="relative">
          <p className="text-sm text-slate-400">{game.icon} {game.title} · {END_LABELS[state.endReason ?? 'done']}</p>
          {result?.isRecord && result.previousBest !== null && <p className="chip mx-auto mt-3 border-amber-400/50 text-amber-300">🏆 Nouveau record personnel ! (ancien : {result.previousBest.toLocaleString('fr-FR')})</p>}
          {result?.isRecord && result.previousBest === null && <p className="chip mx-auto mt-3 border-amber-400/50 text-amber-300">🏆 Premier record établi avec ces paramètres</p>}
          {rank && (
            <p className="mt-4 text-6xl font-black text-amber-300">
              {rank.rank} <span className="text-2xl font-bold text-slate-300">· {rank.label}</span>
            </p>
          )}
          <p className="mt-3 text-sm font-medium uppercase tracking-widest text-slate-400">{verdict}</p>
          <p className="mt-1 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-6xl font-extrabold tabular-nums text-transparent sm:text-7xl">
            {sum.score.toLocaleString('fr-FR')}
          </p>
          <p className="text-xs text-slate-500">{describeConfig(game, config)}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Bonnes réponses" value={`${sum.correct}/${sum.answered}`} />
            <Stat label="Précision" value={`${acc} %`} />
            <Stat label="Temps moyen" value={sum.answered ? fmtMs(sum.avgMs) : '—'} />
            <Stat label="Meilleure série" value={`🔥 ${sum.bestStreak}`} />
          </div>

          {result && result.achievements.length > 0 && (
            <div className="mt-6 space-y-2">
              {result.achievements.map((a) => (
                <p key={a.id} className="animate-pop rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm">
                  <span className="text-xl">{a.icon}</span> Succès débloqué : <strong>{a.title}</strong> — {a.description}
                </p>
              ))}
            </div>
          )}

          {day && (
            <div className="mt-6 rounded-xl bg-white/5 p-4">
              <p className="text-2xl tracking-wider">{gridOf(state)}</p>
              <button className="btn-ghost mt-3" onClick={share}>{copied ? '✓ Copié !' : '📋 Partager (sans les réponses)'}</button>
            </div>
          )}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {!day && <button autoFocus className="btn-primary" onClick={onReplay}>🔄 Rejouer</button>}
            <a className="btn-ghost" href={href('game', game.id)}>⚙️ Changer les paramètres</a>
            <button className="btn-ghost" onClick={onExit}>Retour</button>
          </div>
        </div>
      </div>

      {state.turns.length > 0 && (
        <>
          <h3 className="mb-3 mt-10 text-lg font-bold">Correction</h3>
          <ol className="space-y-3">
            {state.turns.map((t, i) => {
              const right = correctAnswer(t.challenge)
              return (
                <li key={t.challenge.id} className={`card border-l-4 p-4 ${t.grade.correct ? 'border-l-emerald-400' : t.grade.ratio > 0 ? 'border-l-amber-400' : 'border-l-rose-500'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{i + 1}. {t.challenge.prompt}</p>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-violet-300">+{t.points.total}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="text-slate-400">Votre réponse : </span>
                    <span className={t.grade.correct ? 'text-emerald-300' : 'text-rose-300'}>{responseText(t)}</span>
                    {!t.grade.correct && right && (
                      <>
                        <span className="text-slate-400"> · Bonne réponse : </span>
                        <span className="text-emerald-300">{right}</span>
                      </>
                    )}
                    {t.challenge.kind === 'estimate' && <span className="text-slate-400"> · Réponse : {t.challenge.answer.toLocaleString('fr-FR')} {t.challenge.unit}</span>}
                  </p>
                  {t.challenge.explanation && <p className="mt-1 text-sm text-slate-400">{t.challenge.explanation}</p>}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
