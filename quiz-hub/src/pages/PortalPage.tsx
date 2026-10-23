import { GAMES, PORTALS } from '../core/catalog'
import { THEMES, content } from '../content/index'
import { Empty, GameCard, PageHeader, Section } from '../components/ui'
import { href } from '../lib/router'
import { accuracy } from '../lib/storage'
import { useSave } from '../lib/store'

export function PortalPage({ id }: { id: string }) {
  const { data } = useSave()
  const portal = PORTALS.find((p) => p.id === id)
  if (!portal) return <Empty>Cette catégorie n'existe pas. <a className="text-violet-300 underline" href={href()}>Retour à l'accueil</a></Empty>
  const games = GAMES.filter((g) => g.portal === portal.id || g.alsoIn?.includes(portal.id))
  const plays = data.stats[`portal:${id}`]

  return (
    <>
      <div className="card relative mb-8 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at top right, ${portal.color}40, transparent 60%)` }} />
        <div className="relative">
          <a href={href()} className="text-sm text-slate-400 hover:text-white">← Accueil</a>
          <div className="mt-3">
            <PageHeader icon={portal.icon} title={portal.title} subtitle={portal.description} />
          </div>
          <p className="-mt-4 text-sm text-slate-400">
            {games.length} jeux · {plays ? `${plays.plays} partie${plays.plays > 1 ? 's' : ''} jouée${plays.plays > 1 ? 's' : ''}, ${accuracy(plays)} % de réussite` : 'pas encore joué'}
          </p>
        </div>
      </div>

      {(id === 'multi' || id === 'football') && (
        <div className="card mb-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold">Créer ou rejoindre un salon privé</p>
            <p className="text-sm text-slate-400">Un code court à partager, les mêmes questions pour tous, les scores validés par le serveur.</p>
          </div>
          <a href={href('multi')} className="btn-primary">👥 Jouer avec des amis</a>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => <GameCard key={g.id} game={g} />)}
      </div>

      {id === 'culture' && (
        <Section title="Thèmes de culture générale">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {THEMES.map((t) => {
              const n = content.questions.filter((q) => q.t === t.id).length
              const st = data.stats[`theme:${t.id}`]
              return (
                <a key={t.id} href={href('game', 'themed', t.id)} className="card p-4 transition hover:-translate-y-0.5" style={{ boxShadow: `inset 0 1px 0 ${t.color}66` }}>
                  <span className="text-2xl">{t.icon}</span>
                  <p className="mt-2 text-sm font-bold">{t.label}</p>
                  <p className="text-xs text-slate-400">{n} questions</p>
                  <p className="mt-2 text-xs font-semibold" style={{ color: t.color }}>{st ? `${accuracy(st)} % de réussite` : 'Pas encore joué'}</p>
                </a>
              )
            })}
          </div>
        </Section>
      )}
    </>
  )
}
