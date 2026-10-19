import { PageHeader } from '../components/ui'
import { resetSave, updateSave, useSave } from '../lib/store'
import { QUESTION_COUNTS, SECONDS_OPTIONS, type Settings } from '../lib/storage'

function Choice({ label, hint, options, value, unit, onChange }: { label: string; hint: string; options: number[]; value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <fieldset className="card p-6">
      <legend className="sr-only">{label}</legend>
      <p className="font-bold">{label}</p>
      <p className="text-sm text-slate-400">{hint}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={`rounded-xl border px-4 py-2 font-semibold tabular-nums transition ${
              o === value ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {o} {unit}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function SettingsPage() {
  const { data } = useSave()
  const set = (patch: Partial<Settings>) => updateSave((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Enregistrés automatiquement sur cet appareil." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Choice
          label="Questions par partie"
          hint="Nombre de questions tirées au hasard."
          options={QUESTION_COUNTS}
          value={data.settings.questionCount}
          unit="questions"
          onChange={(questionCount) => set({ questionCount })}
        />
        <Choice
          label="Temps par question"
          hint="Plus vous répondez vite, plus vous gagnez de points bonus."
          options={SECONDS_OPTIONS}
          value={data.settings.secondsPerQuestion}
          unit="s"
          onChange={(secondsPerQuestion) => set({ secondsPerQuestion })}
        />
      </div>

      <div className="card mt-8 border-rose-500/20 p-6">
        <p className="font-bold text-rose-300">Zone de danger</p>
        <p className="text-sm text-slate-400">Efface records, historique et paramètres. Action irréversible.</p>
        <button
          className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/20"
          onClick={() => window.confirm('Effacer toutes vos données Quiz Hub ?') && resetSave()}
        >
          Réinitialiser mes données
        </button>
      </div>
    </>
  )
}
