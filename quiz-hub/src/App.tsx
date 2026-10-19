import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { useRoute } from './lib/router'
import { dismissStorageError, useSave } from './lib/store'
import { Dashboard } from './pages/Dashboard'
import { GamesPage } from './pages/GamesPage'
import { PlayPage } from './pages/PlayPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'

export default function App() {
  const route = useRoute()
  const [page = '', a, b] = route
  const { error } = useSave()

  const path = route.join('/')
  useEffect(() => {
    // Braces matter: recent Chrome returns a Promise from scrollTo, which React would treat as a cleanup function.
    window.scrollTo(0, 0)
  }, [path])

  const content =
    page === 'games' ? <GamesPage />
    : page === 'stats' ? <StatsPage />
    : page === 'settings' ? <SettingsPage />
    : page === 'play' ? <PlayPage key={`${a}/${b}`} gameId={a} modeId={b} />
    : <Dashboard />

  return (
    <div className="flex min-h-dvh">
      <Sidebar active={page === 'play' ? 'games' : page} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <span>⚠️ {error}</span>
              <button onClick={dismissStorageError} className="shrink-0 font-semibold text-amber-300 hover:text-white" aria-label="Fermer">
                ✕
              </button>
            </div>
          )}
          {content}
        </div>
      </main>
    </div>
  )
}
