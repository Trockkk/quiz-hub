// Flags (flag-icons, MIT; flag designs are public domain) and logos (simple-icons, CC0) for the visual games.

const flagFiles = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>

const FLAGS: Record<string, string> = Object.fromEntries(
  Object.entries(flagFiles).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
)

export const flagUrl = (code: string): string | undefined => FLAGS[code]

export interface LogoPath {
  path: string
  hex: string
}

let logos: Promise<Record<string, LogoPath>> | null = null

/** Logo paths are only downloaded when a logo game starts (≈ 70 kB gzip). */
export function loadLogos(): Promise<Record<string, LogoPath>> {
  logos ??= import('../content/logo-paths.json').then((m) => m.default as Record<string, LogoPath>)
  return logos
}
