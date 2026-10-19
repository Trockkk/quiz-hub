import { useRef, useState } from 'react'
import { PageHeader } from '../components/ui'
import { importSave, resetSave, updateSave, useSave } from '../lib/store'

export function SettingsPage() {
  const { data } = useSave()
  const [name, setName] = useState(data.player.name)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const saveName = () => updateSave((d) => ({ ...d, player: { name: name.trim().slice(0, 20) } }))

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `quiz-hub-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 2_000_000) return setMsg({ ok: false, text: 'Fichier trop volumineux.' })
    const error = importSave(await f.text())
    setMsg(error ? { ok: false, text: error } : { ok: true, text: 'Sauvegarde importée.' })
  }

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Les réglages de chaque jeu se modifient sur son écran de configuration." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-bold">Pseudonyme</h2>
          <p className="text-sm text-slate-400">Proposé par défaut dans les salons multijoueurs.</p>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); saveName() }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Votre pseudo"
              className="w-full rounded-xl border border-white/10 bg-ink-950/70 px-4 py-2.5 outline-none focus:border-violet-400" />
            <button className="btn-primary shrink-0">Enregistrer</button>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="font-bold">Vos données</h2>
          <p className="text-sm text-slate-400">
            Pas de compte : records, statistiques et préférences sont stockés uniquement dans ce navigateur (localStorage).
            Ils ne sont pas partagés entre appareils et disparaissent si vous effacez les données du site.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={exportData}>⬇️ Exporter</button>
            <button className="btn-ghost" onClick={() => file.current?.click()}>⬆️ Importer</button>
            <input ref={file} type="file" accept="application/json" className="hidden" onChange={(e) => importData(e.target.files?.[0])} />
          </div>
          {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
        </section>

        <section className="card border-rose-500/20 p-6">
          <h2 className="font-bold text-rose-300">Zone de danger</h2>
          <p className="text-sm text-slate-400">Efface records, statistiques, succès, séries et préférences. Irréversible (exportez d'abord si besoin).</p>
          <button className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/20"
            onClick={() => window.confirm('Effacer toutes vos données Quiz Hub ?') && resetSave()}>
            Réinitialiser mes données
          </button>
        </section>

        <section className="card p-6 text-sm text-slate-400">
          <h2 className="font-bold text-slate-100">Crédits et sources</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Drapeaux : <a className="underline" href="https://github.com/lipis/flag-icons" target="_blank" rel="noreferrer">flag-icons</a> (licence MIT ; les drapeaux eux-mêmes relèvent du domaine public).</li>
            <li>Logos : <a className="underline" href="https://simpleicons.org" target="_blank" rel="noreferrer">Simple Icons</a> (données CC0). Les marques et logos restent la propriété de leurs détenteurs ; ils sont utilisés ici à des fins d'identification dans un quiz non commercial.</li>
            <li>Populations : estimations ONU (World Population Prospects), arrondies. Superficies : CIA World Factbook. Autres valeurs : sources citées dans chaque question.</li>
            <li>Questions rédigées pour Quiz Hub ; signalez toute erreur via le dépôt GitHub.</li>
          </ul>
        </section>
      </div>
    </>
  )
}
