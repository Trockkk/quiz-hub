import { useEffect, useState } from 'react'
import type { Media as MediaT } from '../core/types'
import { flagUrl, loadLogos, type LogoPath } from '../lib/media'

export function Flag({ code, className = '' }: { code: string; className?: string }) {
  const url = flagUrl(code)
  if (!url) return <div className={`grid aspect-[4/3] place-items-center rounded-lg bg-white/5 text-xs text-slate-500 ${className}`}>Drapeau indisponible</div>
  return <img src={url} alt="Drapeau à identifier" draggable={false} className={`aspect-[4/3] rounded-lg object-cover shadow-lg ring-1 ring-white/15 ${className}`} />
}

function Logo({ slug, mono, crop, reveal, elapsedMs, revealMs, done }: { slug: string; mono?: boolean; crop?: boolean; reveal?: boolean; elapsedMs: number; revealMs: number; done: boolean }) {
  const [logos, setLogos] = useState<Record<string, LogoPath> | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadLogos().then(setLogos, () => setFailed(true))
  }, [])
  if (failed) return <p className="text-sm text-rose-300">Impossible de charger les logos. Vérifiez votre connexion et rechargez la page.</p>
  const logo = logos?.[slug]
  if (!logo) return <div className="size-40 animate-pulse rounded-3xl bg-white/5" aria-label="Chargement du logo" />
  // Progressive reveal: blurred, then sharp after 80 % of the time.
  const progress = done || !reveal ? 1 : Math.min(1, elapsedMs / (revealMs * 0.8))
  const blur = (1 - progress) * 14
  const color = mono && !done ? '#e2e8f0' : `#${logo.hex}`
  const dark = parseInt(logo.hex, 16) < 0x333333
  return (
    <div className={`grid size-44 place-items-center overflow-hidden rounded-3xl p-6 shadow-xl sm:size-52 ${dark && !(mono && !done) ? 'bg-slate-100' : 'bg-white/[0.06] ring-1 ring-white/10'}`}>
      <svg
        viewBox={crop && !done ? '6 6 12 12' : '0 0 24 24'}
        className="size-full transition-[filter] duration-200"
        style={{ filter: `blur(${blur}px)` }}
        role="img"
        aria-label="Logo à identifier"
      >
        <path d={logo.path} fill={color} />
      </svg>
    </div>
  )
}

export function Media({ media, elapsedMs, revealMs, done }: { media: MediaT; elapsedMs: number; revealMs: number; done: boolean }) {
  switch (media.type) {
    case 'flag':
      return <Flag code={media.code} className="w-56 sm:w-72" />
    case 'logo':
      return <Logo {...media} elapsedMs={elapsedMs} revealMs={revealMs} done={done} />
    case 'letters':
      return (
        <div className="flex flex-wrap justify-center gap-1.5" aria-label={`Lettres : ${media.letters.split('').join(' ')}`}>
          {media.letters.split('').map((l, i) => (
            <span key={i} className="grid size-10 place-items-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-xl font-extrabold text-amber-950 shadow-md sm:size-12">
              {l}
            </span>
          ))}
        </div>
      )
    case 'story':
      return (
        <div className="w-full rounded-xl border border-white/10 bg-ink-950/50 p-4 text-left">
          <p className="font-bold text-cyan-200">🗂️ {media.title}</p>
          <p className="mt-2 text-sm text-slate-300">{media.text}</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {media.clues.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-cyan-300">🔎</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )
  }
}
