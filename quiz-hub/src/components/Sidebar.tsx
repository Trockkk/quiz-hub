import { href } from '../lib/router'

const NAV = [
  { id: '', label: 'Tableau de bord', short: 'Accueil', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { id: 'games', label: 'Jeux', short: 'Jeux', icon: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M7 6h10a5 5 0 015 5v2a5 5 0 01-5 5H7a5 5 0 01-5-5v-2a5 5 0 015-5z' },
  { id: 'stats', label: 'Statistiques', short: 'Stats', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'settings', label: 'Paramètres', short: 'Réglages', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

/** Fixed sidebar on desktop, bottom tab bar on mobile. */
export function Sidebar({ active }: { active: string }) {
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-ink-900/60 p-5 backdrop-blur-xl md:flex">
        <a href={href()} className="mb-10 flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xl shadow-lg shadow-violet-500/30">🎮</span>
          <span className="text-xl font-extrabold tracking-tight">
            Quiz<span className="text-violet-400">Hub</span>
          </span>
        </a>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={href(n.id)}
              aria-current={active === n.id ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                active === n.id ? 'bg-violet-500/15 text-white shadow-[inset_2px_0_0] shadow-violet-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon d={n.icon} />
              {n.label}
            </a>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-slate-500">Gratuit · sans compte · données stockées sur cet appareil</p>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/10 bg-ink-900/90 backdrop-blur-xl md:hidden">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={href(n.id)}
            aria-current={active === n.id ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active === n.id ? 'text-violet-300' : 'text-slate-400'}`}
          >
            <Icon d={n.icon} />
            {n.short}
          </a>
        ))}
      </nav>
    </>
  )
}
