import { GAMES } from '../core/catalog'
import { GameBrowser, PageHeader } from '../components/ui'

export function GamesPage() {
  return (
    <>
      <PageHeader title="Tous les jeux" subtitle={`${GAMES.length} mini-jeux : recherchez par nom, niveau, type ou mode.`} />
      <GameBrowser games={GAMES} autoFocus />
    </>
  )
}
