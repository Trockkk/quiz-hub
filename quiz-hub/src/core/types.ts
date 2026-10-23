// Shared types: used by the website and by the multiplayer server. No DOM, no React here.

export type Difficulty = 1 | 2 | 3 | 4
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { 1: 'Facile', 2: 'Normal', 3: 'Difficile', 4: 'Expert' }

// ---------- Content (src/content/*.json) ----------

export type Continent = 'Afrique' | 'Amérique du Nord' | 'Amérique du Sud' | 'Asie' | 'Europe' | 'Océanie'

export interface Country {
  /** ISO 3166-1 alpha-2, lowercase (also the flag file name) */
  code: string
  name: string
  alt?: string[]
  capital: string
  capitalAlt?: string[]
  continent: Continent
  /** 1 = very well known … 4 = rarely known (editorial) */
  tier: Difficulty
  /** population in millions (UN WPP 2024, 2023 estimates, rounded) */
  pop: number
  /** area in km² (rounded) */
  area: number
  /** UN observer states (Vatican, Palestine) */
  status?: 'observer'
  /** capital not internationally agreed: excluded from capital games */
  disputedCapital?: boolean
}

export interface Territory {
  code: string
  name: string
  alt?: string[]
  /** who it belongs to, as shown to the player */
  sovereign: string
  kind: string
  continent: Continent
  d: Difficulty
}

export interface Question {
  id: string
  t: string
  d: Difficulty
  q: string
  a: string
  /** wrong choices, closest first */
  w: string[]
  alt?: string[]
  x?: string
  src?: string
}

export interface TrueFalse {
  id: string
  t: string
  d: Difficulty
  s: string
  v: boolean
  x: string
}

export interface ClueItem {
  id: string
  t: string
  d: Difficulty
  cat: string
  a: string
  alt?: string[]
  /** vague → precise */
  clues: string[]
}

export interface Word {
  w: string
  alt?: string[]
  d: Difficulty
  /** vague → precise */
  clues: string[]
}

export interface ConnectionsPuzzle {
  id: string
  d: Difficulty
  groups: { label: string; items: string[] }[]
}

export interface OddOne {
  id: string
  d: Difficulty
  items: string[]
  odd: number
  x: string
}

export interface HistEvent {
  id: string
  label: string
  year: number
  d: Difficulty
}

export interface Estimate {
  id: string
  q: string
  a: number
  unit: string
  d: Difficulty
  x?: string
  src: string
}

export interface NamedAnswer {
  n: string
  alt?: string[]
}

export interface ListCategory {
  id: string
  prompt: string
  d: Difficulty
  answers: NamedAnswer[]
}

export interface RareAnswer extends NamedAnswer {
  tier: Difficulty
}

export interface RareQuestion {
  id: string
  prompt: string
  d: Difficulty
  /** how the tiers were decided, shown to the player */
  rule: string
  answers: RareAnswer[]
}

export interface Logo {
  slug: string
  name: string
  alt?: string[]
  d: Difficulty
  sector: string
}

export interface Case {
  id: string
  d: Difficulty
  title: string
  story: string
  clues: string[]
  q: string
  choices: string[]
  a: number
  x: string
}

export interface Ranking {
  id: string
  label: string
  /** "Classez du plus … au plus …" — the property compared */
  prop: string
  unit: string
  src: string
  items: { n: string; v: number }[]
}

export interface Footballer {
  /** Wikidata number (Q…) */
  id: number
  n: string
  alt?: string[]
  /** 1 = superstar … 4 = known by fans (rank by number of Wikipedia languages) */
  d: Difficulty
  /** clubs: [club, start year, end year]; two spans overlapping means they played together */
  c: [string, number, number][]
  /** senior national teams, same format */
  sel: [string, number, number][]
}

export interface Content {
  themes: { id: string; label: string; icon: string; color: string }[]
  questions: Question[]
  truefalse: TrueFalse[]
  clues: ClueItem[]
  words: Word[]
  connections: ConnectionsPuzzle[]
  odd: OddOne[]
  events: HistEvent[]
  estimates: Estimate[]
  lists: ListCategory[]
  rare: RareQuestion[]
  logos: Logo[]
  cases: Case[]
  rankings: Ranking[]
  countries: Country[]
  territories: Territory[]
  footballers: Footballer[]
}

// ---------- Challenges (one question / round, whatever the game) ----------

export type Media =
  | { type: 'flag'; code: string }
  | { type: 'logo'; slug: string; mono?: boolean; crop?: boolean; reveal?: boolean }
  | { type: 'story'; title: string; text: string; clues: string[] }
  | { type: 'letters'; letters: string }

interface ChallengeBase {
  id: string
  d: Difficulty
  theme?: string
  prompt: string
  media?: Media
  explanation?: string
  source?: string
  /** extra hints the player may reveal (each costs points) */
  hints?: string[]
}

export interface McqChallenge extends ChallengeBase {
  kind: 'mcq'
  choices: string[]
  /** when choices are flags, their country codes (aligned with choices) */
  choiceFlags?: string[]
  answer: number
}

export interface TextChallenge extends ChallengeBase {
  kind: 'text'
  accept: string[]
  /** canonical answer shown at reveal */
  display: string
  /** names that must never be fuzzy-matched to this answer (e.g. Niger vs Nigeria) */
  exclusive?: string[]
  /** optional propositions: QCM mode, or revealable in mixed mode */
  choices?: string[]
  /** progressive clues; the first one is shown for free */
  clues?: string[]
  /** number of tries allowed (default 1) */
  attempts?: number
  numeric?: boolean
}

export interface EstimateChallenge extends ChallengeBase {
  kind: 'estimate'
  answer: number
  unit: string
  /** error at which the score reaches 0 */
  scale: number
  min?: number
  max?: number
}

export interface OrderChallenge extends ChallengeBase {
  kind: 'order'
  /** shuffled display order */
  items: string[]
  values: number[]
  labels: string[]
  dir: 'asc' | 'desc'
}

export interface ListChallenge extends ChallengeBase {
  kind: 'list'
  answers: NamedAnswer[]
  /** each answer must start with the last letter of the previous one */
  chain?: boolean
  exclusive?: string[]
  /** teammate chain: random draw in [0, 1) choosing the player who names the first footballer */
  opener?: number
}

export interface RareChallenge extends ChallengeBase {
  kind: 'rare'
  rule: string
  answers: RareAnswer[]
  exclusive?: string[]
}

export interface ConnectionsChallenge extends ChallengeBase {
  kind: 'connections'
  groups: { label: string; items: string[] }[]
  items: string[]
  mistakes: number
}

export type Challenge =
  | McqChallenge
  | TextChallenge
  | EstimateChallenge
  | OrderChallenge
  | ListChallenge
  | RareChallenge
  | ConnectionsChallenge

export type ChallengeKind = Challenge['kind']

/** What the player submitted. */
export type Response =
  | { kind: 'mcq'; choice: number | null; hintsUsed?: number }
  | { kind: 'text'; text: string | null; usedChoices?: boolean; tries?: number; cluesShown?: number; hintsUsed?: number }
  | { kind: 'estimate'; value: number | null }
  | { kind: 'order'; order: number[] }
  | { kind: 'list'; found: string[] }
  | { kind: 'rare'; text: string | null }
  | { kind: 'connections'; solved: number; mistakes: number }

export interface Grade {
  /** 0..1 quality of the answer */
  ratio: number
  /** counts as a right answer (accuracy, streaks, survival) */
  correct: boolean
  /** list / rare games: points already decided by the content (before difficulty multiplier) */
  fixedPoints?: number
  /** canonical form of what was matched, for display */
  matched?: string
  /** rare: tier of the matched answer */
  tier?: Difficulty
}

// ---------- Games ----------

export type PortalId = 'culture' | 'logos' | 'drapeaux' | 'capitales' | 'logique' | 'mots' | 'rapidite' | 'multi' | 'quotidien' | 'football'
export type GameType = 'quiz' | 'visuel' | 'logique' | 'mots' | 'rapidite' | 'estimation'
export type PlayMode = 'solo' | 'multi' | 'daily'
export type AnswerType = 'qcm' | 'text' | 'mixed'

export interface Config {
  difficulty: Difficulty
  /** number of questions / rounds (0 = endless, until time or error) */
  count: number
  /** seconds per question, null = unlimited */
  questionTime: number | null
  /** seconds for the whole game, null = unlimited */
  totalTime: number | null
  themes: string[]
  answerType: AnswerType
  hints: boolean
  explanations: boolean
  shuffle: boolean
  variant: string
}

export interface Variant {
  id: string
  label: string
  description: string
}

/** Which settings the config screen shows, and their allowed values. */
export interface OptionSpec {
  difficulty?: boolean
  count?: number[]
  customCount?: boolean
  questionTime?: (number | null)[]
  totalTime?: (number | null)[]
  themes?: boolean
  answerType?: AnswerType[]
  hints?: boolean
  explanations?: boolean
  shuffle?: boolean
  variants?: Variant[]
}

export interface Rules {
  /** game ends at the first wrong answer */
  endOnError?: boolean
  /** lives before game over */
  lives?: number
  /** streak bonus: +step per answer after the 2nd in a row, capped */
  streakStep?: number
  streakCap?: number
  /** ladder scoring (quiz progressif) */
  ladder?: boolean
  /** no speed bonus (estimation, lists…) */
  noSpeedBonus?: boolean
}

export interface GenContext {
  content: Content
  config: Config
  rng: () => number
  /** recently seen challenge ids, served last */
  recent?: Set<string>
}

export interface GameMeta {
  id: string
  title: string
  tagline: string
  icon: string
  portal: PortalId
  /** extra portals where the game is also listed */
  alsoIn?: PortalId[]
  type: GameType
  modes: PlayMode[]
  rules: string[]
  options: OptionSpec
  defaults: Partial<Config>
  /** shown instead of the difficulty picker */
  fixedDifficulty?: string
  engine: Rules
  /** challenge-based games */
  generate?: (ctx: GenContext) => Challenge[]
  /** games with their own component (memory, reflexes) */
  custom?: 'memory' | 'reflex'
  /** only playable in a multiplayer room */
  multiOnly?: boolean
}
