import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Turn } from '../core/engine'
import { TIER_LABELS, TIER_POINTS } from '../core/scoring'
import { findAnswer, lastLetter, firstLetter, matches } from '../core/text'
import type {
  Challenge, Config, ConnectionsChallenge, EstimateChallenge, ListChallenge, McqChallenge, OrderChallenge, RareChallenge, Response, TextChallenge,
} from '../core/types'
import { Flag } from './Media'

export interface ViewProps<C extends Challenge = Challenge> {
  ch: C
  turn: Turn | null
  config: Config
  onSubmit: (r: Response) => void
  setDraft: (r: Response | null) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const input =
  'w-full rounded-xl border border-white/10 bg-ink-950/70 px-4 py-3 text-lg outline-none transition placeholder:text-slate-500 focus:border-violet-400 disabled:opacity-60'

function HintBar({ hints, used, onUse, extra }: { hints: string[]; used: number; onUse: () => void; extra?: ReactNode }) {
  if (!hints.length && !extra) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      {hints.slice(0, used).map((h) => (
        <span key={h} className="chip border-amber-400/40 text-amber-200">💡 {h}</span>
      ))}
      {used < hints.length && (
        <button type="button" onClick={onUse} className="chip border-amber-400/40 text-amber-200 hover:bg-amber-500/10">
          💡 Indice (−25 %)
        </button>
      )}
      {extra}
    </div>
  )
}

// ---------- Multiple choice (text or flags) ----------

export function McqView({ ch, turn, config, onSubmit }: ViewProps<McqChallenge>) {
  const [hidden, setHidden] = useState<number[]>([])
  const [hintsUsed, setHintsUsed] = useState(0)
  const done = turn !== null
  const chosen = turn?.response?.kind === 'mcq' ? turn.response.choice : null
  const fiftyUsed = hidden.length > 0
  const submit = (i: number) => !done && !hidden.includes(i) && onSubmit({ kind: 'mcq', choice: i, hintsUsed: hintsUsed + (fiftyUsed ? 1 : 0) })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= ch.choices.length) submit(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fifty = () => {
    const wrong = ch.choices.map((_, i) => i).filter((i) => i !== ch.answer)
    setHidden(wrong.sort(() => Math.random() - 0.5).slice(0, ch.choices.length - 2))
  }

  const flags = ch.choiceFlags
  return (
    <>
      <div className={`grid gap-3 ${flags ? 'grid-cols-2' : ch.choices.length === 2 ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
        {ch.choices.map((choice, i) => {
          const state = !done
            ? hidden.includes(i) ? 'invisible' : 'border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-violet-400/60 hover:bg-violet-500/10'
            : i === ch.answer
              ? 'border-emerald-400/80 bg-emerald-500/15 text-emerald-50 animate-pop'
              : i === chosen
                ? 'border-rose-400/80 bg-rose-500/15 text-rose-50 animate-shake'
                : 'border-white/5 opacity-40'
          return (
            <button
              key={i}
              disabled={done}
              onClick={() => submit(i)}
              aria-label={flags ? `Drapeau ${i + 1}${done ? ` : ${choice}` : ''}` : undefined}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left font-medium transition ${state} ${flags ? 'flex-col' : ''}`}
            >
              {flags ? (
                <>
                  <Flag code={flags[i]} className="w-full max-w-48" />
                  {done && <span className="text-sm">{choice}</span>}
                </>
              ) : (
                <>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold">{LETTERS[i]}</span>
                  {choice}
                </>
              )}
            </button>
          )
        })}
      </div>
      {!done && config.hints && (
        <HintBar
          hints={ch.hints ?? []}
          used={hintsUsed}
          onUse={() => setHintsUsed((h) => h + 1)}
          extra={ch.choices.length >= 4 && !fiftyUsed ? <button type="button" onClick={fifty} className="chip border-amber-400/40 text-amber-200 hover:bg-amber-500/10">✂️ 50/50 (−25 %)</button> : null}
        />
      )}
    </>
  )
}

// ---------- Typed answer (with tries, clues and optional propositions) ----------

export function TextView({ ch, turn, config, onSubmit }: ViewProps<TextChallenge>) {
  const [text, setText] = useState('')
  const [tries, setTries] = useState(1)
  const [cluesShown, setCluesShown] = useState(1)
  const [hintsUsed, setHintsUsed] = useState(0)
  // QCM mode only applies when the challenge actually has propositions (typed-only games have none).
  const qcmOnly = config.answerType === 'qcm' && !!ch.choices
  const [showChoices, setShowChoices] = useState(qcmOnly)
  const [miss, setMiss] = useState<string[]>([])
  const ref = useRef<HTMLInputElement>(null)
  const done = turn !== null
  const maxTries = ch.attempts ?? 1
  const clues = ch.clues ?? []
  const penalized = config.answerType === 'mixed'

  useEffect(() => ref.current?.focus(), [])

  const check = (guess: string) =>
    ch.numeric ? ch.accept.some((a) => Number(a) === Number(guess.replace(',', '.').trim())) : matches(ch.accept, guess, ch.exclusive)

  const send = (guess: string, usedChoices = false) => {
    if (done || !guess.trim()) return
    const ok = check(guess)
    if (!ok && tries < maxTries) {
      // Wrong try: another clue is revealed, the player keeps going.
      setMiss((m) => [...m, guess])
      setTries((t) => t + 1)
      setCluesShown((c) => Math.min(clues.length, c + 1))
      setText('')
      ref.current?.focus()
      return
    }
    onSubmit({ kind: 'text', text: guess, tries, cluesShown: clues.length ? cluesShown : undefined, usedChoices: usedChoices && penalized, hintsUsed })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
  }

  const given = turn?.response?.kind === 'text' ? turn.response.text : null
  return (
    <div>
      {clues.length > 0 && (
        <ol className="mb-4 space-y-2">
          {clues.slice(0, done ? clues.length : cluesShown).map((c, i) => (
            <li key={i} className={`flex gap-3 rounded-xl border p-3 text-sm animate-pop ${i < cluesShown ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/5 opacity-60'}`}>
              <span className="font-bold text-cyan-300">{i + 1}</span>
              {c}
            </li>
          ))}
        </ol>
      )}
      {!done && clues.length > 0 && cluesShown < clues.length && (
        <button type="button" className="chip mb-4 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10" onClick={() => setCluesShown((c) => c + 1)}>
          🔎 Indice suivant (moins de points)
        </button>
      )}
      {!done ? (
        <>
          {!qcmOnly && (
            <form onSubmit={submit} className="flex gap-2">
              <input
                ref={ref}
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode={ch.numeric ? 'numeric' : 'text'}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={ch.numeric ? 'Votre nombre…' : 'Votre réponse…'}
                aria-label="Votre réponse"
                className={input}
              />
              <button className="btn-primary shrink-0" disabled={!text.trim()}>Valider</button>
            </form>
          )}
          {maxTries > 1 && maxTries < 99 && <p className="mt-2 text-xs text-slate-400">Essai {tries} / {maxTries}</p>}
          {miss.length > 0 && (
            <p key={miss.length} className="mt-2 animate-shake text-sm text-rose-300" aria-live="polite">
              ✗ {miss.map((m) => `« ${m} »`).join(', ')} : ce n'est pas ça.
            </p>
          )}
          {ch.choices && !showChoices && (
            <button type="button" className="chip mt-4 border-violet-400/40 text-violet-200 hover:bg-violet-500/10" onClick={() => setShowChoices(true)}>
              📋 Afficher les propositions (points ÷ 2)
            </button>
          )}
          {ch.choices && showChoices && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {ch.choices.map((c, i) => (
                <button key={c} onClick={() => send(c, true)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left font-medium transition hover:border-violet-400/60 hover:bg-violet-500/10">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-bold">{LETTERS[i]}</span>
                  {c}
                </button>
              ))}
            </div>
          )}
          {config.hints && <HintBar hints={ch.hints ?? []} used={hintsUsed} onUse={() => setHintsUsed((h) => h + 1)} />}
        </>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          Votre réponse : <strong className={turn.grade.correct ? 'text-emerald-300' : 'text-rose-300'}>{given ?? '— (temps écoulé)'}</strong>
        </p>
      )}
    </div>
  )
}

// ---------- Estimation ----------

export function EstimateView({ ch, turn, onSubmit }: ViewProps<EstimateChallenge>) {
  const [value, setValue] = useState('')
  const done = turn !== null
  const n = Number(value.replace(/\s/g, '').replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(n)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid && !done) onSubmit({ kind: 'estimate', value: n })
  }
  const given = turn?.response?.kind === 'estimate' ? turn.response.value : null
  return done ? (
    <div className="grid grid-cols-2 gap-3 text-center">
      <div className="rounded-xl bg-white/5 p-4">
        <p className="text-xs text-slate-400">Votre estimation</p>
        <p className="text-2xl font-bold tabular-nums">{given === null ? '—' : given.toLocaleString('fr-FR')}</p>
      </div>
      <div className="rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/30">
        <p className="text-xs text-slate-400">Bonne réponse</p>
        <p className="text-2xl font-bold tabular-nums text-emerald-300">{ch.answer.toLocaleString('fr-FR')} {ch.unit}</p>
      </div>
      <p className="col-span-2 text-sm text-slate-400">Précision : {Math.round(turn.grade.ratio * 100)} %</p>
    </div>
  ) : (
    <form onSubmit={submit} className="flex gap-2">
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="Votre estimation" aria-label="Votre estimation" className={input} />
      {ch.unit && <span className="self-center whitespace-nowrap text-sm text-slate-400">{ch.unit}</span>}
      <button className="btn-primary shrink-0" disabled={!valid}>Valider</button>
    </form>
  )
}

// ---------- Ordering ----------

export function OrderView({ ch, turn, onSubmit, setDraft }: ViewProps<OrderChallenge>) {
  const [order, setOrder] = useState(() => ch.items.map((_, i) => i))
  const [picked, setPicked] = useState<number | null>(null)
  const done = turn !== null
  useEffect(() => setDraft({ kind: 'order', order }), [order, setDraft])
  const move = (pos: number, delta: number) => {
    const to = pos + delta
    if (to < 0 || to >= order.length) return
    const o = [...order]
    ;[o[pos], o[to]] = [o[to], o[pos]]
    setOrder(o)
  }
  // Tap two items to swap them (handy on mobile).
  const tap = (pos: number) => {
    if (picked === null) return setPicked(pos)
    if (picked !== pos) {
      const o = [...order]
      ;[o[picked], o[pos]] = [o[pos], o[picked]]
      setOrder(o)
    }
    setPicked(null)
  }
  const shown = done && turn.response?.kind === 'order' ? turn.response.order : order
  const correctOrder = [...ch.items.keys()].sort((a, b) => (ch.dir === 'asc' ? ch.values[a] - ch.values[b] : ch.values[b] - ch.values[a]))
  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">{ch.dir === 'asc' ? '⬆️ En haut : le plus petit / le plus ancien' : '⬆️ En haut : le plus grand'}</p>
      <ol className="space-y-2">
        {shown.map((item, pos) => {
          const right = done && correctOrder[pos] === item
          return (
            <li
              key={item}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                done ? (right ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-rose-400/60 bg-rose-500/10') : picked === pos ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold">{pos + 1}</span>
              <button type="button" disabled={done} onClick={() => tap(pos)} className="min-w-0 flex-1 text-left font-medium">
                {ch.items[item]}
                {done && <span className="ml-2 text-xs text-slate-400">({ch.labels[item]})</span>}
              </button>
              {!done && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Monter" onClick={() => move(pos, -1)} disabled={pos === 0} className="rounded-lg bg-white/10 px-2.5 py-1 disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Descendre" onClick={() => move(pos, 1)} disabled={pos === order.length - 1} className="rounded-lg bg-white/10 px-2.5 py-1 disabled:opacity-30">↓</button>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {done ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <p className="font-semibold">Bon ordre :</p>
          <p className="mt-1 text-slate-300">{correctOrder.map((i) => `${ch.items[i]} (${ch.labels[i]})`).join(' → ')}</p>
        </div>
      ) : (
        <button className="btn-primary mt-4 w-full sm:w-auto" onClick={() => onSubmit({ kind: 'order', order })}>Valider l'ordre</button>
      )}
    </div>
  )
}

// ---------- Lists (and capital chains) ----------

export function ListView({ ch, turn, onSubmit, setDraft }: ViewProps<ListChallenge>) {
  const [text, setText] = useState('')
  const [found, setFound] = useState<number[]>([])
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const done = turn !== null
  const names = ch.answers.map((a) => [a.n, ...(a.alt ?? [])])
  useEffect(() => setDraft({ kind: 'list', found: found.map((i) => ch.answers[i].n) }), [found, ch, setDraft])

  const add = (e: FormEvent) => {
    e.preventDefault()
    const guess = text.trim()
    if (!guess) return
    const i = findAnswer(names, guess, ch.exclusive)
    const last = found.at(-1)
    let msg: { ok: boolean; msg: string }
    if (i < 0) msg = { ok: false, msg: `« ${guess} » n'est pas une réponse valide.` }
    else if (found.includes(i)) msg = { ok: false, msg: `${ch.answers[i].n} : déjà trouvé !` }
    else if (ch.chain && last !== undefined && firstLetter(ch.answers[i].n) !== lastLetter(ch.answers[last].n))
      msg = { ok: false, msg: `${ch.answers[i].n} ne commence pas par « ${lastLetter(ch.answers[last].n).toUpperCase()} ».` }
    else {
      setFound((f) => [...f, i])
      msg = { ok: true, msg: `✓ ${ch.answers[i].n}` }
    }
    setFlash(msg)
    setText('')
    ref.current?.focus()
  }

  const shownFound = done && turn.response?.kind === 'list' ? turn.response.found : found.map((i) => ch.answers[i].n)
  const missing = ch.answers.filter((a) => !shownFound.includes(a.n))
  const last = found.at(-1)
  return (
    <div>
      {!done && (
        <>
          <form onSubmit={add} className="flex gap-2">
            <input
              ref={ref}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={ch.chain && last !== undefined ? `Commence par « ${lastLetter(ch.answers[last].n).toUpperCase()} »…` : 'Tapez une réponse puis Entrée'}
              aria-label="Réponse"
              className={input}
            />
            <button className="btn-primary shrink-0">Ajouter</button>
          </form>
          <p className={`mt-2 h-5 text-sm ${flash?.ok ? 'text-emerald-300' : 'text-rose-300'}`} aria-live="polite">{flash?.msg}</p>
        </>
      )}
      <p className="mt-3 text-sm font-semibold">
        {shownFound.length} trouvée{shownFound.length > 1 ? 's' : ''} {!ch.chain && <span className="text-slate-400">sur {ch.answers.length}</span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {shownFound.map((n) => <span key={n} className="chip border-emerald-400/40 text-emerald-200">{n}</span>)}
      </div>
      {done && !ch.chain && missing.length > 0 && (
        <details className="mt-4" open={missing.length <= 30}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">Réponses manquantes ({missing.length})</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((a) => <span key={a.n} className="chip text-slate-400">{a.n}</span>)}
          </div>
        </details>
      )}
      {!done && <button className="btn-ghost mt-4" onClick={() => onSubmit({ kind: 'list', found: found.map((i) => ch.answers[i].n) })}>J'ai terminé</button>}
    </div>
  )
}

// ---------- Rare answer ----------

const TIER_COLORS = ['', 'text-slate-300', 'text-sky-300', 'text-violet-300', 'text-amber-300']

export function RareView({ ch, turn, onSubmit }: ViewProps<RareChallenge>) {
  const [text, setText] = useState('')
  const done = turn !== null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() && !done) onSubmit({ kind: 'rare', text })
  }
  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
        {([1, 2, 3, 4] as const).map((t) => (
          <div key={t} className="rounded-lg bg-white/5 p-2">
            <p className={`font-bold ${TIER_COLORS[t]}`}>{TIER_LABELS[t]}</p>
            <p className="text-slate-400">{TIER_POINTS[t]} pts</p>
          </div>
        ))}
      </div>
      {!done ? (
        <form onSubmit={submit} className="flex gap-2">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Une seule réponse : visez la rareté !" aria-label="Votre réponse" className={input} />
          <button className="btn-primary shrink-0" disabled={!text.trim()}>Valider</button>
        </form>
      ) : (
        <>
          <p className="text-sm">
            Votre réponse : <strong className={turn.grade.correct ? 'text-emerald-300' : 'text-rose-300'}>{turn.response?.kind === 'rare' ? (turn.response.text ?? '—') : '—'}</strong>
            {turn.grade.tier && <span className={`ml-2 font-bold ${TIER_COLORS[turn.grade.tier]}`}>{TIER_LABELS[turn.grade.tier]}</span>}
          </p>
          <div className="mt-3 space-y-2">
            {([4, 3, 2, 1] as const).map((t) => {
              const list = ch.answers.filter((a) => a.tier === t)
              return list.length ? (
                <p key={t} className="text-sm">
                  <span className={`font-bold ${TIER_COLORS[t]}`}>{TIER_LABELS[t]} :</span>{' '}
                  <span className="text-slate-300">{list.map((a) => (a.n === turn.grade.matched ? `【${a.n}】` : a.n)).join(', ')}</span>
                </p>
              ) : null
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">{ch.rule}</p>
        </>
      )}
    </div>
  )
}

// ---------- Connections ----------

const GROUP_COLORS = ['bg-amber-400/80 text-amber-950', 'bg-emerald-400/80 text-emerald-950', 'bg-sky-400/80 text-sky-950', 'bg-violet-400/80 text-violet-950']

export function ConnectionsView({ ch, turn, onSubmit, setDraft }: ViewProps<ConnectionsChallenge>) {
  const [solved, setSolved] = useState<number[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [msg, setMsg] = useState('')
  const done = turn !== null
  useEffect(() => setDraft({ kind: 'connections', solved: solved.length, mistakes }), [solved, mistakes, setDraft])

  const toggle = (item: string) => setSelected((s) => (s.includes(item) ? s.filter((x) => x !== item) : s.length < 4 ? [...s, item] : s))
  const check = () => {
    const g = ch.groups.findIndex((gr) => selected.every((i) => gr.items.includes(i)))
    if (g >= 0) {
      const next = [...solved, g]
      setSolved(next)
      setSelected([])
      setMsg(`✓ ${ch.groups[g].label}`)
      if (next.length === ch.groups.length) onSubmit({ kind: 'connections', solved: next.length, mistakes })
      return
    }
    const close = ch.groups.some((gr, i) => !solved.includes(i) && selected.filter((x) => gr.items.includes(x)).length === 3)
    const m = mistakes + 1
    setMistakes(m)
    setMsg(close ? 'Presque ! Il en manque un…' : 'Ce n’est pas un groupe.')
    if (m >= ch.mistakes) onSubmit({ kind: 'connections', solved: solved.length, mistakes: m })
  }

  const remaining = ch.items.filter((i) => !solved.some((g) => ch.groups[g].items.includes(i)))
  const groupsShown = done ? ch.groups.map((_, i) => i) : solved
  return (
    <div>
      <div className="space-y-2">
        {groupsShown.map((g) => (
          <div key={g} className={`animate-pop rounded-xl p-3 text-center ${GROUP_COLORS[g % 4]} ${done && !solved.includes(g) ? 'opacity-60' : ''}`}>
            <p className="text-sm font-extrabold uppercase">{ch.groups[g].label}</p>
            <p className="text-sm">{ch.groups[g].items.join(' · ')}</p>
          </div>
        ))}
      </div>
      {!done && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {remaining.map((item) => (
              <button
                key={item}
                onClick={() => toggle(item)}
                aria-pressed={selected.includes(item)}
                className={`min-h-14 rounded-xl border px-2 py-3 text-sm font-semibold transition ${selected.includes(item) ? 'border-violet-300 bg-violet-500/40 text-white' : 'border-white/10 bg-white/[0.05] hover:bg-white/10'}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={selected.length !== 4} onClick={check}>Valider le groupe</button>
            <button className="btn-ghost" onClick={() => setSelected([])} disabled={!selected.length}>Désélectionner</button>
            <span className="text-sm text-slate-400">
              Erreurs : {'●'.repeat(mistakes)}{'○'.repeat(Math.max(0, ch.mistakes - mistakes))}
            </span>
          </div>
          <p className="mt-2 h-5 text-sm text-slate-300" aria-live="polite">{msg}</p>
        </>
      )}
    </div>
  )
}

export function ChallengeView(props: ViewProps) {
  const { ch } = props
  switch (ch.kind) {
    case 'mcq': return <McqView {...props} ch={ch} />
    case 'text': return <TextView {...props} ch={ch} />
    case 'estimate': return <EstimateView {...props} ch={ch} />
    case 'order': return <OrderView {...props} ch={ch} />
    case 'list': return <ListView {...props} ch={ch} />
    case 'rare': return <RareView {...props} ch={ch} />
    case 'connections': return <ConnectionsView {...props} ch={ch} />
  }
}
