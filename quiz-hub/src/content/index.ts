// All game content, assembled from the JSON files of this folder.
// To add questions: edit the JSON files (see README). `npm test` checks their validity.
import type { Content, Difficulty, Footballer, Question } from '../core/types.ts'
import cases from './cases.json' with { type: 'json' }
import clues from './clues.json' with { type: 'json' }
import connections from './connections.json' with { type: 'json' }
import countries from './countries.json' with { type: 'json' }
import estimates from './estimates.json' with { type: 'json' }
import events from './events.json' with { type: 'json' }
import lists from './lists.json' with { type: 'json' }
import logos from './logos.json' with { type: 'json' }
import odd from './odd.json' with { type: 'json' }
import arts from './questions/arts.json' with { type: 'json' }
import cinema from './questions/cinema.json' with { type: 'json' }
import geo from './questions/geo.json' with { type: 'json' }
import histoire from './questions/histoire.json' with { type: 'json' }
import insolite from './questions/insolite.json' with { type: 'json' }
import jv from './questions/jeux-video.json' with { type: 'json' }
import musique from './questions/musique.json' with { type: 'json' }
import personnalites from './questions/personnalites.json' with { type: 'json' }
import sciences from './questions/sciences.json' with { type: 'json' }
import sport from './questions/sport.json' with { type: 'json' }
import tech from './questions/tech.json' with { type: 'json' }
import villes from './questions/villes.json' with { type: 'json' }
import rankings from './rankings.json' with { type: 'json' }
import rare from './rare.json' with { type: 'json' }
import territories from './territories.json' with { type: 'json' }
import truefalse from './truefalse.json' with { type: 'json' }
import words from './words.json' with { type: 'json' }

export const THEMES = [
  { id: 'geo', label: 'Géographie et pays', icon: '🌍', color: '#10b981' },
  { id: 'villes', label: 'Capitales et villes', icon: '🏙️', color: '#14b8a6' },
  { id: 'histoire', label: 'Histoire', icon: '🏛️', color: '#f59e0b' },
  { id: 'sciences', label: 'Sciences et nature', icon: '🧪', color: '#06b6d4' },
  { id: 'sport', label: 'Sport', icon: '🏆', color: '#8b5cf6' },
  { id: 'cinema', label: 'Cinéma et séries', icon: '🎬', color: '#ef4444' },
  { id: 'musique', label: 'Musique', icon: '🎵', color: '#ec4899' },
  { id: 'jeux-video', label: 'Jeux vidéo', icon: '🎮', color: '#6366f1' },
  { id: 'tech', label: 'Technologie et Internet', icon: '💻', color: '#3b82f6' },
  { id: 'personnalites', label: 'Personnalités', icon: '⭐', color: '#eab308' },
  { id: 'arts', label: 'Arts et littérature', icon: '🎨', color: '#d946ef' },
  { id: 'insolite', label: 'Insolite et anecdotes', icon: '🦄', color: '#f97316' },
]

type RawQuestion = Omit<Question, 't'>
const byTheme: Record<string, RawQuestion[]> = {
  geo, villes, histoire, sciences, sport, cinema, musique, 'jeux-video': jv, tech, personnalites, arts, insolite,
} as Record<string, RawQuestion[]>

export const content = {
  themes: THEMES,
  questions: Object.entries(byTheme).flatMap(([t, qs]) => qs.map((q) => ({ ...q, t }))),
  truefalse,
  clues,
  words,
  connections,
  odd,
  events,
  estimates,
  lists,
  rare,
  logos,
  cases,
  rankings,
  countries,
  territories,
  footballers: [],
} as Content

/** footballers.json as written by scripts/build-footballers.mjs: team names shared, spans flattened. */
interface RawFootballers {
  teams: [string, 0 | 1][]
  players: [number, string, Difficulty, number[], string[]?][]
}

let loading: Promise<void> | undefined

/** The footballer base is big (tens of thousands of players): loaded only when a football game needs it. */
export function loadFootballers(): Promise<void> {
  loading ??= import('./footballers.json', { with: { type: 'json' } }).then(({ default: raw }) => {
    const { teams, players } = raw as unknown as RawFootballers
    content.footballers = players.map(([id, n, d, flat, alt]): Footballer => {
      const p: Footballer = { id, n, d, c: [], sel: [], ...(alt && { alt }) }
      for (let i = 0; i < flat.length; i += 3) (teams[flat[i]][1] ? p.sel : p.c).push([teams[flat[i]][0], flat[i + 1], flat[i + 2]])
      return p
    })
  })
  return loading
}
