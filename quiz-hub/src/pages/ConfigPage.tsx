import { useState, type ReactNode } from 'react'
import { DEFAULT_CONFIG, PORTALS, configFor, configKey, getGame } from '../core/catalog'
import { DIFFICULTY_LABELS, type AnswerType, type Config, type Difficulty } from '../core/types'
import { THEMES, content } from '../content/index'
import { Empty } from '../components/ui'
import { ANSWER_LABELS, describeConfig, fmtTime } from '../lib/format'
import { href, navigate } from '../lib/router'
import { updateSave, useSave } from '../lib/store'
import { todayKey } from '../core/games/special'

const DIFF_DESC: Record<Difficulty, string> = {
  1: 'Contenus très connus, moins de propositions, tolérance large.',
  2: 'Le bon équilibre : propositions plus proches.',
  3: 'Contenus pointus, pièges plausibles.',
  4: 'Pour les spécialistes : détails méconnus, marges serrées.',
}

const ANSWER_DESC: Record<AnswerType, string> = {
  qcm: 'Choisir parmi des propositions.',
  text: 'Écrire la réponse (accents et petites fautes tolérés).',
  mixed: 'Écrire, ou afficher les propositions pour moitié moins de points.',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="card p-5">
      <legend className="sr-only">{label}</legend>
      <p className="font-bold">{label}</p>
      {hint && <p className="text-sm text-slate-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}

const chipCls = (active: boolean) =>
  `rounded-xl border px-4 py-2 text-sm font-semibold tabular-nums transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`

function Chips<T>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={o === value} className={chipCls(o === value)} onClick={() => onChange(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="card flex cursor-pointer items-center justify-between gap-4 p-5">
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-slate-400">{hint}</span>
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/10 transition after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-violet-500 peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-violet-400" aria-hidden />
    </label>
  )
}

export function ConfigPage({ id, preset }: { id: string; preset?: string }) {
  const { data } = useSave()
  const game = getGame(id)
  const [config, setConfig] = useState<Config>(() =>
    game ? configFor(game, { ...data.prefs[game.id], ...(preset && THEMES.some((t) => t.id === preset) ? { themes: [preset] } : {}) }) : DEFAULT_CONFIG,
  )
  const [customOpen, setCustomOpen] = useState(() => !!game?.options.count && !game.options.count.includes(config.count))
  if (!game) return <Empty>Ce jeu n'existe pas. <a className="text-violet-300 underline" href={href('games')}>Voir tous les jeux</a></Empty>
  if (game.multiOnly) {
    navigate('multi')
    return null
  }
  const o = game.options
  const portal = PORTALS.find((p) => p.id === game.portal)!
  // Settings are saved as soon as they change: they are restored next time.
  const set = (patch: Partial<Config>) => {
    const next = configFor(game, { ...config, ...patch })
    setConfig(next)
    updateSave((d) => ({ ...d, prefs: { ...d.prefs, [game.id]: next } }))
  }
  const reset = () => {
    const next = configFor(game)
    setConfig(next)
    setCustomOpen(false)
    updateSave((d) => {
      const prefs = { ...d.prefs }
      delete prefs[game.id]
      return { ...d, prefs }
    })
  }
  const record = data.records[configKey(game, config)]
  const needsTheme = game.id === 'themed' && config.themes.length === 0
  const dailyDone = game.id === 'daily' && !!data.daily.results[todayKey()]
  const themeCount = (t: string) => (game.id === 'truefalse' ? content.truefalse : game.id === 'clues' ? content.clues : content.questions).filter((q) => q.t === t).length

  return (
    <div className="mx-auto max-w-5xl">
      <a href={href('portal', game.portal)} className="text-sm text-slate-400 hover:text-white">← {portal.icon} {portal.title}</a>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="card relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at top right, ${portal.color}40, transparent 60%)` }} />
            <div className="relative flex items-start gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl text-4xl" style={{ background: portal.color + '30', boxShadow: `inset 0 0 0 1px ${portal.color}66` }}>{game.icon}</span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">{game.title}</h1>
                <p className="mt-1 text-slate-300">{game.tagline}</p>
              </div>
            </div>
            <ul className="relative mt-5 space-y-1.5 text-sm text-slate-300">
              {game.rules.map((r) => (
                <li key={r} className="flex gap-2"><span style={{ color: portal.color }}>▸</span>{r}</li>
              ))}
            </ul>
          </div>

          {o.difficulty ? (
            <Field label="Difficulté" hint="Change vraiment le contenu et les règles, pas seulement le nom.">
              <div className="grid gap-2 sm:grid-cols-2">
                {([1, 2, 3, 4] as Difficulty[]).map((d) => (
                  <button key={d} type="button" aria-pressed={config.difficulty === d} onClick={() => set({ difficulty: d })}
                    className={`rounded-xl border p-3 text-left transition ${config.difficulty === d ? 'border-violet-400 bg-violet-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <span className="font-bold">{DIFFICULTY_LABELS[d]}</span>
                    <span className="block text-xs text-slate-400">{DIFF_DESC[d]}</span>
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            game.fixedDifficulty && <p className="card p-4 text-sm"><strong>Difficulté :</strong> <span className="text-slate-300">{game.fixedDifficulty}</span></p>
          )}

          {o.variants && (
            <Field label="Mode de jeu">
              <div className="grid gap-2 sm:grid-cols-2">
                {o.variants.map((v) => (
                  <button key={v.id} type="button" aria-pressed={config.variant === v.id} onClick={() => set({ variant: v.id })}
                    className={`rounded-xl border p-3 text-left transition ${config.variant === v.id ? 'border-violet-400 bg-violet-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <span className="font-bold">{v.label}</span>
                    <span className="block text-xs text-slate-400">{v.description}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {o.count && (
            <Field label={game.id === 'listing' ? 'Nombre de manches' : game.id === 'connections' || game.id === 'detective' ? 'Nombre d’énigmes' : 'Nombre de questions'}>
              <div className="flex flex-wrap items-center gap-2">
                <Chips options={o.count} value={customOpen ? -1 : config.count} onChange={(n) => { setCustomOpen(false); set({ count: n }) }} label={String} />
                {o.customCount && (
                  <button type="button" aria-pressed={customOpen} className={chipCls(customOpen)} onClick={() => setCustomOpen(true)}>Personnalisé</button>
                )}
                {customOpen && (
                  <input type="number" min={1} max={100} value={config.count} aria-label="Nombre personnalisé"
                    onChange={(e) => set({ count: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
                    className="w-24 rounded-xl border border-violet-400 bg-ink-950 px-3 py-2 font-semibold tabular-nums outline-none" />
                )}
              </div>
            </Field>
          )}

          {o.totalTime && (
            <Field label="Durée totale de la partie" hint="Le chrono global ; « illimité » le désactive sans toucher au temps par question.">
              <Chips options={o.totalTime} value={config.totalTime} onChange={(totalTime) => set({ totalTime })} label={(v) => (v === null ? 'Illimitée' : fmtTime(v))} />
            </Field>
          )}

          {o.questionTime && (
            <Field label={game.id === 'listing' || game.id.startsWith('capital-chain') ? 'Temps par manche' : 'Temps par question'} hint="« Illimité » supprime le compte à rebours de chaque question ; le bonus de vitesse reste mesuré.">
              <Chips options={o.questionTime} value={config.questionTime} onChange={(questionTime) => set({ questionTime })} label={(v) => (v === null ? 'Illimité' : fmtTime(v))} />
            </Field>
          )}

          {o.themes && (
            <Field label="Thèmes" hint={game.id === 'themed' ? 'Choisissez au moins un thème.' : 'Aucun thème sélectionné = tous les thèmes mélangés.'}>
              <div className="flex flex-wrap gap-2">
                {game.id !== 'themed' && (
                  <button type="button" aria-pressed={config.themes.length === 0} className={chipCls(config.themes.length === 0)} onClick={() => set({ themes: [] })}>✨ Tous</button>
                )}
                {THEMES.filter((t) => themeCount(t.id) > 0).map((t) => {
                  const on = config.themes.includes(t.id)
                  return (
                    <button key={t.id} type="button" aria-pressed={on} className={chipCls(on)}
                      onClick={() => set({ themes: on ? config.themes.filter((x) => x !== t.id) : [...config.themes, t.id] })}>
                      {t.icon} {t.label} <span className="text-xs font-normal text-slate-400">({themeCount(t.id)})</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          {o.answerType && o.answerType.length > 1 && (
            <Field label="Type de réponse">
              <div className="grid gap-2 sm:grid-cols-3">
                {o.answerType.map((a) => (
                  <button key={a} type="button" aria-pressed={config.answerType === a} onClick={() => set({ answerType: a })}
                    className={`rounded-xl border p-3 text-left transition ${config.answerType === a ? 'border-violet-400 bg-violet-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <span className="font-bold">{ANSWER_LABELS[a]}</span>
                    <span className="block text-xs text-slate-400">{ANSWER_DESC[a]}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {o.hints && <Toggle label="Indices" hint="Jokers 50/50 et indices, chacun −25 % de points." value={config.hints} onChange={(hints) => set({ hints })} />}
            {o.explanations && <Toggle label="Explications" hint="Afficher l'explication après chaque réponse. Désactivé : on enchaîne directement." value={config.explanations} onChange={(explanations) => set({ explanations })} />}
            {o.shuffle && <Toggle label="Mélanger les questions" hint="Désactivé : du plus facile au plus difficile." value={config.shuffle} onChange={(shuffle) => set({ shuffle })} />}
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card space-y-4 p-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Récapitulatif</p>
            <p className="font-semibold">{describeConfig(game, config)}</p>
            <div className="rounded-xl bg-white/5 p-3 text-sm">
              {record ? (
                <>🏆 Record avec ces paramètres : <strong>{record.best.toLocaleString('fr-FR')} pts</strong> <span className="text-slate-400">({record.plays} partie{record.plays > 1 ? 's' : ''})</span></>
              ) : (
                <span className="text-slate-400">Aucun record avec ces paramètres pour l'instant.</span>
              )}
            </div>
            {dailyDone && <p className="text-sm text-amber-200">Vous avez déjà joué le défi d'aujourd'hui : une nouvelle partie ne comptera pas pour la série.</p>}
            <button
              type="button"
              disabled={needsTheme}
              onClick={() => {
                updateSave((d) => ({ ...d, prefs: { ...d.prefs, [game.id]: config } }))
                navigate('play', game.id)
              }}
              className="btn-primary w-full text-lg disabled:opacity-50"
            >
              ▶ Lancer la partie
            </button>
            {needsTheme && <p className="text-sm text-amber-200">Sélectionnez au moins un thème.</p>}
            <div className="flex gap-2">
              <a href={href('portal', game.portal)} className="btn-ghost flex-1 text-sm">← Retour</a>
              <button type="button" onClick={reset} className="btn-ghost flex-1 text-sm">↺ Réinitialiser</button>
            </div>
            {game.modes.includes('multi') && (
              <a href={href('multi')} className="block text-center text-sm text-indigo-300 hover:underline">👥 Jouer à ce jeu avec des amis</a>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
