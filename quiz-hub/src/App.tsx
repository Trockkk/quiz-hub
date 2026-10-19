import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { href, useRoute } from './lib/router'
import { dismissStorageError, useSave } from './lib/store'
import { ConfigPage } from './pages/ConfigPage'
import { GamesPage } from './pages/GamesPage'
import { Home } from './pages/Home'
import { MultiPage } from './pages/MultiPage'
import { PlayPage } from './pages/PlayPage'
import { PortalPage } from './pages/PortalPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'

/** Addresses of the first version (#/play/quiz/<category>) now open the classic quiz settings. */
const LEGACY_THEMES: Record<string, string> = { histoire: 'histoire', geographie: 'geo', sciences: 'sciences', arts: 'arts', sport: 'sport' }

export default function App() {
  const route = useRoute()
  const [page = '', a, b] = route
  const { error } = useSave()
  const legacy = page === 'play' && a === 'quiz'

  const path = route.join('/')
  useEffect(() => {
    // Braces matter: recent Chrome returns a Promise from scrollTo, which React would treat as a cleanup function.
    window.scrollTo(0, 0)
  }, [path])

  useEffect(() => {
    if (legacy) window.location.replace(LEGACY_THEMES[b] ? href('game', 'classic', LEGACY_THEMES[b]) : href('game', 'classic'))
  }, [legacy, b])

  const content =
    legacy ? null
    : page === 'games' ? <GamesPage />
    : page === 'portal' ? <PortalPage key={a} id={a} />
    : page === 'game' ? <ConfigPage key={`${a}/${b}`} id={a} preset={b} />
    : page === 'play' ? <PlayPage key={a} id={a} />
    : page === 'multi' ? <MultiPage code={a} />
    : page === 'stats' ? <StatsPage />
    : page === 'settings' ? <SettingsPage />
    : <Home />

  const active = page === 'game' && a === 'daily' ? 'daily' : ['portal', 'game', 'play'].includes(page) ? 'games' : page

  return (
    <div className="flex min-h-dvh">
      <Sidebar active={active} portal={page === 'portal' ? a : undefined} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <a href={href()} className="flex items-center gap-2 font-extrabold">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">🎮</span>
            Quiz<span className="-ml-2 text-violet-400">Hub</span>
          </a>
          <a href={href('settings')} className="rounded-lg p-2 text-slate-400 hover:bg-white/5" aria-label="Paramètres">⚙️</a>
        </header>
        <main className="px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pb-12 lg:pt-10">
          <div className="mx-auto max-w-6xl">
            {error && (
              <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <span>⚠️ {error}</span>
                <button onClick={dismissStorageError} className="shrink-0 font-semibold text-amber-300 hover:text-white" aria-label="Fermer">✕</button>
              </div>
            )}
            {content}
          </div>
        </main>
      </div>
    </div>
  )
}
