import { GameCard, PageHeader } from '../components/ui'
import { games } from '../games/registry'

export function GamesPage() {
  return (
    <>
      <PageHeader title="Jeux" subtitle="Choisissez un mini-jeu et un mode." />
      <div className="grid gap-4">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">D’autres mini-jeux arrivent bientôt…</p>
    </>
  )
}
