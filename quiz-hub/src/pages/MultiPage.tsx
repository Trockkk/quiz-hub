import { useEffect, useRef, useState, type FormEvent } from 'react'
import { GAMES, getGame } from '../core/catalog'
import { CODE_LENGTH, isRoomCode, type ClientMessage, type PublicChallenge, type PublicRoom } from '../core/protocol'
import { DIFFICULTY_LABELS, type Config, type Difficulty, type Response } from '../core/types'
import { Empty, PageHeader } from '../components/ui'
import { describeConfig, fmtMs, fmtTime } from '../lib/format'
import { href, navigate } from '../lib/router'
import { recordSession, updateSave, useSave } from '../lib/store'
import { MP_URL, createRoom, useRoom, type Status } from '../multi/client'
import { Flag, Media } from '../play/Media'

const MULTI_GAMES = GAMES.filter((g) => g.modes.includes('multi'))
const input = 'w-full rounded-xl border border-white/10 bg-ink-950/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-violet-400'

export function MultiPage({ code }: { code?: string }) {
  if (!MP_URL) return <NotConfigured />
  if (code) return isRoomCode(code) ? <RoomView code={code} /> : <Empty>Code de salon invalide. <a className="text-violet-300 underline" href={href('multi')}>Retour</a></Empty>
  return <Lobby />
}

function NotConfigured() {
  return (
    <>
      <PageHeader icon="👥" title="Jouer avec des amis" subtitle="Salons privés en temps réel." />
      <div className="card max-w-2xl p-6">
        <p className="text-lg font-bold">Le serveur multijoueur n'est pas encore configuré</p>
        <p className="mt-2 text-slate-300">
          Le site est hébergé sur GitHub Pages, qui ne sert que des fichiers statiques : le jeu en direct a besoin d'un petit serveur temps réel.
          Le projet en contient un, prêt à déployer gratuitement sur Cloudflare (dossier <code className="rounded bg-white/10 px-1">server/</code>).
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Créer un compte Cloudflare gratuit.</li>
          <li>Dans <code>server/</code> : <code>npx wrangler login</code> puis <code>npm run deploy</code>.</li>
          <li>Ajouter l'adresse obtenue comme variable <code>MP_URL</code> du dépôt GitHub et relancer le déploiement.</li>
        </ol>
        <p className="mt-4 text-sm text-slate-400">Les étapes détaillées sont dans le README du projet. En attendant, tous les jeux solo restent disponibles.</p>
        <button className="btn-primary mt-5" disabled>Créer un salon (indisponible)</button>
      </div>
    </>
  )
}

function Lobby() {
  const { data } = useSave()
  const [name, setName] = useState(data.player.name)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveName = () => updateSave((d) => ({ ...d, player: { name: name.trim().slice(0, 20) } }))
  const create = async () => {
    saveName()
    setBusy(true)
    setError(null)
    try {
      navigate('multi', await createRoom())
    } catch (e) {
      setError(e instanceof Error ? `Impossible de créer le salon : ${e.message}` : 'Impossible de joindre le serveur.')
    } finally {
      setBusy(false)
    }
  }
  const join = (e: FormEvent) => {
    e.preventDefault()
    const c = joinCode.trim().toUpperCase()
    if (!isRoomCode(c)) return setError(`Un code contient ${CODE_LENGTH} caractères (lettres et chiffres).`)
    saveName()
    navigate('multi', c)
  }

  return (
    <>
      <PageHeader icon="👥" title="Jouer avec des amis" subtitle="Créez un salon privé, partagez le code, jouez en direct." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-6">
          <p className="font-bold">1. Votre pseudo</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Pseudo (facultatif)" className={`${input} mt-3`} />
        </div>
        <div className="card p-6">
          <p className="font-bold">2a. Créer un salon</p>
          <p className="mt-1 text-sm text-slate-400">Vous serez l'hôte : vous choisissez le jeu et lancez la partie.</p>
          <button className="btn-primary mt-4 w-full" onClick={create} disabled={busy}>{busy ? 'Création…' : '✨ Créer un salon'}</button>
        </div>
        <form className="card p-6" onSubmit={join}>
          <p className="font-bold">2b. Rejoindre avec un code</p>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={CODE_LENGTH} placeholder="EX. K7PQ2"
            className={`${input} mt-3 text-center font-mono text-2xl uppercase tracking-[0.4em]`} aria-label="Code du salon" />
          <button className="btn-ghost mt-3 w-full">Rejoindre</button>
        </form>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <div className="card mt-8 p-6 text-sm text-slate-300">
        <p className="font-bold text-white">Jeux disponibles en multijoueur</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MULTI_GAMES.map((g) => <span key={g.id} className="chip">{g.icon} {g.title}</span>)}
        </div>
        <p className="mt-4 text-slate-400">Tout le monde reçoit les mêmes questions au même moment. Les réponses sont vérifiées et les points calculés par le serveur : les bonnes réponses ne sont envoyées qu'une fois la question close.</p>
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, [string, string]> = {
    connecting: ['bg-amber-400', 'Connexion…'],
    open: ['bg-emerald-400', 'Connecté'],
    reconnecting: ['bg-amber-400 animate-pulse', 'Reconnexion…'],
    closed: ['bg-rose-500', 'Déconnecté'],
  }
  const [dot, label] = map[status]
  return <span className="chip"><span className={`size-2 rounded-full ${dot}`} />{label}</span>
}

function useClock(active: boolean) {
  const [, setT] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setT((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [active])
}

function RoomView({ code }: { code: string }) {
  const { data } = useSave()
  const { room, you, status, fatal, notice, setNotice, ack, send, serverNow } = useRoom(code, data.player.name)
  const [copied, setCopied] = useState(false)
  useClock(!!room && room.phase !== 'lobby' && room.phase !== 'results')
  useRecordResult(room, you)

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice, setNotice])

  if (fatal) return <Empty>{fatal} <a className="text-violet-300 underline" href={href('multi')}>Retour</a></Empty>
  if (!room || !you) return <div className="card p-10 text-center text-slate-400"><span className="animate-pulse">Connexion au salon {code}…</span></div>

  const isHost = room.hostId === you
  const game = getGame(room.gameId)!
  const link = `${location.origin}${location.pathname}#/multi/${code}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Lien d’invitation :', link)
    }
  }
  const leave = () => {
    send({ t: 'leave' })
    navigate('multi')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0 space-y-4">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-slate-400">Code du salon</p>
            <p className="font-mono text-3xl font-black tracking-[0.3em] text-violet-200">{code}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <button className="btn-ghost text-sm" onClick={copy}>{copied ? '✓ Lien copié' : '🔗 Inviter'}</button>
            <button className="btn-ghost text-sm" onClick={leave}>Quitter</button>
          </div>
        </div>
        {notice && <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">{notice}</p>}

        {room.phase === 'lobby' && <LobbyPanel room={room} isHost={isHost} send={send} />}
        {room.phase === 'countdown' && (
          <div className="card grid h-72 place-items-center text-center">
            <div>
              <p className="text-slate-400">{game.icon} {game.title} commence dans</p>
              <p key={Math.ceil(((room.deadline ?? 0) - serverNow()) / 1000)} className="animate-pop text-9xl font-black text-violet-300">
                {Math.max(1, Math.ceil(((room.deadline ?? 0) - serverNow()) / 1000))}
              </p>
            </div>
          </div>
        )}
        {(room.phase === 'question' || room.phase === 'reveal') && room.challenge && (
          <QuestionPanel key={`${room.index}`} room={room} you={you} isHost={isHost} send={send} serverNow={serverNow} ack={ack} />
        )}
        {room.phase === 'results' && room.final && (
          <div className="card p-6">
            <h2 className="text-center text-2xl font-extrabold">🏁 Classement final</h2>
            <div className="mt-6 flex items-end justify-center gap-3">
              {[1, 0, 2].map((i) => room.final![i] && (
                <div key={i} className="text-center">
                  <p className="text-3xl">{['🥇', '🥈', '🥉'][i]}</p>
                  <p className="max-w-28 truncate font-bold">{room.final![i].name}</p>
                  <div className={`mt-2 w-24 rounded-t-xl bg-gradient-to-t from-violet-700 to-fuchsia-500 ${['h-32', 'h-24', 'h-16'][i]}`} />
                  <p className="mt-1 text-sm tabular-nums">{room.final![i].score.toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr><th className="p-2">#</th><th className="p-2">Joueur</th><th className="p-2">Score</th><th className="p-2">Bonnes rép.</th><th className="p-2">Temps moyen</th><th className="p-2">Série</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {room.final.map((f, i) => (
                    <tr key={f.id} className={f.id === you ? 'bg-violet-500/10' : ''}>
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-semibold">{f.name}{f.id === you && ' (vous)'}</td>
                      <td className="p-2 font-bold tabular-nums text-violet-300">{f.score.toLocaleString('fr-FR')}</td>
                      <td className="p-2 tabular-nums">{f.correct}/{f.answered}</td>
                      <td className="p-2 tabular-nums">{f.avgMs ? fmtMs(f.avgMs) : '—'}</td>
                      <td className="p-2 tabular-nums">🔥 {f.bestStreak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {isHost ? <button className="btn-primary" onClick={() => send({ t: 'replay' })}>🔄 Nouvelle partie</button> : <p className="text-sm text-slate-400">L'hôte peut relancer une partie.</p>}
              <button className="btn-ghost" onClick={leave}>Quitter le salon</button>
            </div>
          </div>
        )}
      </div>

      <aside className="card h-fit p-4 lg:sticky lg:top-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Joueurs ({room.players.filter((p) => p.connected).length}/{room.players.length})</p>
        <ul className="space-y-2">
          {[...room.players].sort((a, b) => b.score - a.score).map((p) => {
            const turn = room.turn?.playerId === p.id
            return (
              <li key={p.id} className={`flex items-center gap-2 rounded-lg p-2 text-sm ${p.id === you ? 'bg-violet-500/10' : ''} ${turn ? 'ring-2 ring-amber-400' : ''}`}>
                <span className={`size-2.5 shrink-0 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-slate-600'}`} title={p.connected ? 'Connecté' : 'Déconnecté'} />
                <span className={`min-w-0 flex-1 truncate ${p.connected ? '' : 'text-slate-500'}`}>
                  {room.hostId === p.id && '👑 '}{p.name}{p.id === you && ' (vous)'}
                </span>
                {room.phase === 'question' && (room.challenge?.kind === 'list' ? <span className="text-xs text-slate-400">{room.turn ? (p.alive ? '' : '💀') : `${p.found} ✓`}</span> : <span className="text-xs">{p.answered ? '✅' : '⏳'}</span>)}
                <span className="font-semibold tabular-nums text-violet-300">{p.score.toLocaleString('fr-FR')}</span>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}

/** Saves the multiplayer result in the local statistics, once per finished game. */
function useRecordResult(room: PublicRoom | null, you: string | null) {
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (!room?.final || !you) return
    const id = `${room.code}-${room.final.map((f) => f.score).join('-')}`
    if (done.current === id) return
    done.current = id
    const me = room.final.find((f) => f.id === you)
    const game = getGame(room.gameId)
    if (!me || !game || me.answered === 0) return
    const rank = room.final.indexOf(me) + 1
    recordSession({
      key: `multi|${game.id}`, gameId: game.id, portal: 'multi', score: me.score, correct: me.correct, answered: me.answered, avgMs: me.avgMs,
      timeMs: me.avgMs * me.answered, bestStreak: me.bestStreak, d: room.config.difficulty, date: new Date().toISOString(),
      label: `Multijoueur · ${room.final.length} joueur${room.final.length > 1 ? 's' : ''} · ${rank}${rank === 1 ? 'er' : 'e'}`, perTheme: {}, seen: [],
    })
  }, [room, you])
}

function LobbyPanel({ room, isHost, send }: { room: PublicRoom; isHost: boolean; send: (m: ClientMessage) => void }) {
  const game = getGame(room.gameId)!
  const o = game.options
  const set = (gameId: string, patch: Partial<Config>) => send({ t: 'config', gameId, config: patch })
  const chip = (active: boolean) => `rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'} disabled:cursor-default`
  const connected = room.players.filter((p) => p.connected).length
  return (
    <div className="card p-5">
      <p className="font-bold">{isHost ? 'Choisissez le jeu et les paramètres' : 'Jeu choisi par l’hôte'}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {MULTI_GAMES.map((g) => (
          <button key={g.id} disabled={!isHost} onClick={() => set(g.id, {})}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${g.id === room.gameId ? 'border-violet-400 bg-violet-500/20' : 'border-white/10 bg-white/5'} ${isHost ? 'hover:bg-white/10' : 'opacity-60'} ${!isHost && g.id !== room.gameId ? 'hidden sm:flex' : ''}`}>
            <span className="text-2xl">{g.icon}</span>
            <span className="font-semibold">{g.title}</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-1 text-sm text-slate-300">{game.rules.map((r) => <li key={r}>▸ {r}</li>)}</ul>
      <div className="mt-5 space-y-3 text-sm">
        {o.difficulty && (
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-slate-400">Difficulté</span>
            {([1, 2, 3, 4] as Difficulty[]).map((d) => <button key={d} disabled={!isHost} className={chip(room.config.difficulty === d)} onClick={() => set(room.gameId, { difficulty: d })}>{DIFFICULTY_LABELS[d]}</button>)}
          </div>
        )}
        {o.variants && (
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-slate-400">Mode</span>
            {o.variants.map((v) => <button key={v.id} disabled={!isHost} title={v.description} className={chip(room.config.variant === v.id)} onClick={() => set(room.gameId, { variant: v.id })}>{v.label}</button>)}
          </div>
        )}
        {o.count && (
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-slate-400">Manches</span>
            {o.count.filter((n) => n <= 20).map((n) => <button key={n} disabled={!isHost} className={chip(room.config.count === n)} onClick={() => set(room.gameId, { count: n })}>{n}</button>)}
          </div>
        )}
        {o.questionTime && (
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-slate-400">Temps</span>
            {o.questionTime.map((t) => <button key={String(t)} disabled={!isHost} className={chip(room.config.questionTime === t)} onClick={() => set(room.gameId, { questionTime: t })}>{t === null ? 'Illimité' : fmtTime(t)}</button>)}
          </div>
        )}
        {o.answerType && o.answerType.includes('text') && (
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-slate-400">Réponses</span>
            {(['qcm', 'text'] as const).filter((a) => o.answerType!.includes(a)).map((a) => <button key={a} disabled={!isHost} className={chip(room.config.answerType === a)} onClick={() => set(room.gameId, { answerType: a })}>{a === 'qcm' ? 'QCM' : 'Saisie libre'}</button>)}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500">{describeConfig(game, room.config)}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isHost ? (
          <>
            <button className="btn-primary" onClick={() => send({ t: 'start' })}>▶ Lancer la partie</button>
            {connected < 2 && <span className="text-sm text-slate-400">Vous êtes seul : partagez le code, ou lancez pour tester.</span>}
          </>
        ) : (
          <p className="text-sm text-slate-400"><span className="animate-pulse">⏳</span> En attente du lancement par l'hôte…</p>
        )}
      </div>
    </div>
  )
}

function QuestionPanel({ room, you, isHost, send, serverNow, ack }: {
  room: PublicRoom; you: string; isHost: boolean; send: (m: ClientMessage) => void; serverNow: () => number; ack: ReturnType<typeof useRoom>['ack']
}) {
  const ch = room.challenge!
  const reveal = room.reveal
  const me = room.players.find((p) => p.id === you)
  const [sent, setSent] = useState<string | null>(null)
  const post = send
  const answer = (r: Response, label: string) => {
    if (sent || reveal) return
    post({ t: 'answer', index: room.index, response: r })
    setSent(label)
  }
  const now = serverNow()
  const deadline = room.turn?.deadline ?? room.deadline
  const total = room.turn ? 15_000 : (room.config.questionTime ?? 0) * 1000
  const left = deadline === null ? null : Math.max(0, deadline - now)
  return (
    <div className="card overflow-hidden">
      <div className="h-1.5 bg-white/5">{left !== null && !reveal && <div className="h-full bg-violet-400 transition-[width] duration-200" style={{ width: `${total ? (left / total) * 100 : 0}%` }} />}</div>
      <div className="p-5 sm:p-7">
        <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
          <span>Manche {room.index + 1} / {room.total}</span>
          {left !== null && !reveal && <span className="font-mono text-lg font-bold text-white">{Math.ceil(left / 1000)} s</span>}
          {left === null && !reveal && isHost && <button className="btn-ghost text-xs" onClick={() => post({ t: 'skip' })}>Clore la question</button>}
        </div>
        <h2 className="text-xl font-bold sm:text-2xl">{ch.prompt}</h2>
        {'media' in ch && ch.media && <div className="my-5 flex justify-center"><Media media={ch.media} elapsedMs={0} revealMs={1} done={false} /></div>}

        {!reveal && (
          <div className="mt-5">
            {ch.kind === 'list' ? (
              <ListAnswer ch={ch} room={room} you={you} post={post} ack={ack} />
            ) : sent ? (
              <p className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4 text-center">Réponse envoyée : <strong>{sent}</strong><br /><span className="text-sm text-slate-400">En attente des autres joueurs…</span></p>
            ) : (
              <AnswerInput ch={ch} onAnswer={answer} />
            )}
          </div>
        )}

        {reveal && (
          <div className="mt-6 animate-pop">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-slate-400">Bonne réponse</p>
              <p className="text-lg font-bold text-emerald-200">{reveal.answer}</p>
              {reveal.details && <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-sm text-slate-300">{reveal.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              {reveal.explanation && <p className="mt-2 text-sm text-slate-300">{reveal.explanation}</p>}
            </div>
            <ul className="mt-4 space-y-1.5">
              {[...reveal.results].sort((a, b) => b.points - a.points).map((r) => {
                const p = room.players.find((x) => x.id === r.id)
                return (
                  <li key={r.id} className={`flex items-center justify-between gap-3 rounded-lg p-2 text-sm ${r.id === you ? 'bg-violet-500/10' : 'bg-white/5'}`}>
                    <span className="min-w-0 truncate">{r.correct ? '✅' : '❌'} <strong>{p?.name ?? '?'}</strong> <span className="text-slate-400">— {r.answer}</span></span>
                    <span className="shrink-0 font-bold tabular-nums text-violet-300">+{r.points}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-center text-xs text-slate-500">{room.index + 1 < room.total ? 'Manche suivante dans quelques secondes…' : 'Résultats dans quelques secondes…'} {me && `Votre score : ${me.score.toLocaleString('fr-FR')}`}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AnswerInput({ ch, onAnswer }: { ch: PublicChallenge; onAnswer: (r: Response, label: string) => void }) {
  const [text, setText] = useState('')
  const [order, setOrder] = useState(() => (ch.kind === 'order' ? ch.items.map((_, i) => i) : []))
  const submitText = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (ch.kind === 'estimate') {
      const n = Number(text.replace(/\s/g, '').replace(',', '.'))
      if (Number.isFinite(n)) onAnswer({ kind: 'estimate', value: n }, n.toLocaleString('fr-FR'))
    } else onAnswer(ch.kind === 'rare' ? { kind: 'rare', text } : { kind: 'text', text }, text)
  }
  if (ch.kind === 'mcq') {
    return (
      <div className={`grid gap-3 ${ch.choiceFlags || ch.choices.length === 2 ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
        {ch.choices.map((c, i) => (
          <button key={c} onClick={() => onAnswer({ kind: 'mcq', choice: i }, c)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left font-medium transition hover:border-violet-400/60 hover:bg-violet-500/10">
            {ch.choiceFlags ? <Flag code={ch.choiceFlags[i]} className="w-full" /> : <><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold">{'ABCD'[i]}</span>{c}</>}
          </button>
        ))}
      </div>
    )
  }
  if (ch.kind === 'order') {
    const move = (pos: number, delta: number) => {
      const o = [...order]
      const to = pos + delta
      if (to < 0 || to >= o.length) return
      ;[o[pos], o[to]] = [o[to], o[pos]]
      setOrder(o)
    }
    return (
      <div>
        <p className="mb-2 text-xs text-slate-400">{ch.dir === 'asc' ? 'En haut : le plus petit / le plus ancien' : 'En haut : le plus grand'}</p>
        <ol className="space-y-2">
          {order.map((item, pos) => (
            <li key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className="font-bold">{pos + 1}</span><span className="flex-1">{ch.items[item]}</span>
              <button aria-label="Monter" onClick={() => move(pos, -1)} className="rounded-lg bg-white/10 px-2.5 py-1">↑</button>
              <button aria-label="Descendre" onClick={() => move(pos, 1)} className="rounded-lg bg-white/10 px-2.5 py-1">↓</button>
            </li>
          ))}
        </ol>
        <button className="btn-primary mt-4" onClick={() => onAnswer({ kind: 'order', order }, 'ordre envoyé')}>Valider l'ordre</button>
      </div>
    )
  }
  return (
    <form onSubmit={submitText} className="flex gap-2">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={input} autoComplete="off" spellCheck={false}
        inputMode={ch.kind === 'estimate' || (ch.kind === 'text' && ch.numeric) ? 'decimal' : 'text'}
        placeholder={ch.kind === 'estimate' ? `Votre estimation ${ch.unit ? `(${ch.unit})` : ''}` : ch.kind === 'rare' ? 'Une réponse, la plus rare possible' : 'Votre réponse'} aria-label="Votre réponse" />
      <button className="btn-primary shrink-0" disabled={!text.trim()}>Valider</button>
    </form>
  )
}

function ListAnswer({ ch, room, you, post, ack }: { ch: Extract<PublicChallenge, { kind: 'list' }>; room: PublicRoom; you: string; post: (m: ClientMessage) => void; ack: ReturnType<typeof useRoom>['ack'] }) {
  const [text, setText] = useState('')
  const [found, setFound] = useState<string[]>([])
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ack?.found) setFound(ack.found)
  }, [ack])
  const turn = room.turn
  const myTurn = !turn || turn.playerId === you
  const me = room.players.find((p) => p.id === you)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !myTurn) return
    post({ t: 'guess', index: room.index, text })
    setText('')
    ref.current?.focus()
  }
  return (
    <div>
      {turn && (
        <p className={`mb-3 rounded-xl p-3 text-center font-semibold ${myTurn ? 'bg-amber-500/20 text-amber-100' : 'bg-white/5 text-slate-300'}`}>
          {me && !me.alive ? '💀 Vous êtes éliminé pour cette manche.' : myTurn ? '🎯 À vous ! Une réponse inédite avant la fin du chrono.' : `Au tour de ${room.players.find((p) => p.id === turn.playerId)?.name ?? '…'}`}
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input ref={ref} autoFocus value={text} onChange={(e) => setText(e.target.value)} disabled={!myTurn || (me ? !me.alive && !!turn : false)} className={input} autoComplete="off" spellCheck={false} placeholder="Tapez une réponse puis Entrée" aria-label="Réponse" />
        <button className="btn-primary shrink-0" disabled={!myTurn}>Envoyer</button>
      </form>
      {ack && Date.now() - ack.at < 3000 && <p className={`mt-2 text-sm ${ack.ok ? 'text-emerald-300' : 'text-rose-300'}`} aria-live="polite">{ack.msg}</p>}
      {turn ? (
        <div className="mt-3 flex flex-wrap gap-1.5">{turn.used.map((u) => <span key={u} className="chip text-slate-300">{u}</span>)}</div>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold">{found.length} trouvée{found.length > 1 ? 's' : ''} <span className="text-slate-400">sur {ch.total}</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">{found.map((f) => <span key={f} className="chip border-emerald-400/40 text-emerald-200">{f}</span>)}</div>
        </>
      )}
    </div>
  )
}
