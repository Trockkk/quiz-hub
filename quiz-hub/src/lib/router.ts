import { useSyncExternalStore } from 'react'

// Hash routing: GitHub Pages serves a single index.html, so no 404 fallback is needed.
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** "#/play/quiz/all" -> ["play", "quiz", "all"] */
export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/')

export const navigate = (...parts: string[]) => {
  window.location.hash = href(...parts)
}
