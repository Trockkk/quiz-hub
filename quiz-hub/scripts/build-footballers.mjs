// Builds src/content/footballers.json from Wikidata: every footballer with a Wikipedia page in at least
// MIN_SITELINKS languages, their senior clubs and national teams with start / end years (property P54).
// Usage: npm run footballers   (takes a few minutes; answers are cached in the OS temp folder between runs)
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MIN_SITELINKS = Number(process.env.MIN_SITELINKS ?? 10)
const BATCH = 250
const ENDPOINT = 'https://query.wikidata.org/sparql'
const HEADERS = { 'User-Agent': 'quiz-hub-build/1.0 (https://github.com/Trockkk)', Accept: 'application/sparql-results+json' }
const CACHE = join(tmpdir(), 'quiz-hub-footballers')
mkdirSync(CACHE, { recursive: true })
const NOW = new Date().getFullYear()

// national association football team, and its newer "men's" subclass
const NATIONAL = ['Q6979593', 'Q135408445']
// Youth, reserve and amateur sides would create false "teammates".
const NOT_SENIOR = /\b(U-? ?\d{2}|under-?\d{2}|moins de \d{2}|sub-?\d{2}|olympi\w*|espoirs?|jeunes|youth|juniors?|juvenil|primavera|reserves?|réserve|amateurs?|castilla|atlètic|jong|academy|académie|femenino|féminine|women)\b|\s(B|C|II|III|A')$/i

const qid = (uri) => Number(uri.slice(uri.lastIndexOf('/Q') + 2))
const year = (v) => (v ? Number(v.value.slice(0, v.value.indexOf('-', 1))) : null)

async function sparql(name, query) {
  const file = join(CACHE, `${name}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ query }) })
    if (res.ok) {
      const rows = (await res.json()).results.bindings
      writeFileSync(file, JSON.stringify(rows))
      return rows
    }
    if (attempt >= 5) throw new Error(`${name}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    await new Promise((r) => setTimeout(r, attempt * 5000))
  }
}

const values = (ids) => ids.map((id) => `wd:Q${id}`).join(' ')
const chunks = (list) => Array.from({ length: Math.ceil(list.length / BATCH) }, (_, i) => list.slice(i * BATCH, (i + 1) * BATCH))

/** Runs batches 3 at a time (Wikidata asks for few parallel queries). */
async function batched(name, ids, makeQuery) {
  const out = []
  const parts = chunks(ids)
  for (let i = 0; i < parts.length; i += 3) {
    const rows = await Promise.all(parts.slice(i, i + 3).map((part, j) => sparql(`${name}-${MIN_SITELINKS}-${i + j}`, makeQuery(values(part)))))
    out.push(...rows.flat())
    process.stdout.write(`\r${name}: ${Math.min(i + 3, parts.length)}/${parts.length}`)
  }
  process.stdout.write('\n')
  return out
}

// 1. Players and their fame.
const list = await sparql(`players-${MIN_SITELINKS}`, `SELECT ?p ?sl WHERE { ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_SITELINKS}) }`)
const fame = new Map(list.map((r) => [qid(r.p.value), Number(r.sl.value)]))
const ids = [...fame.keys()]
console.log(`${ids.length} players`)

// 2. Names (French, else English) and short alternative names.
const names = new Map()
for (const r of await batched('names', ids, (v) => `SELECT ?p ?fr ?en (GROUP_CONCAT(DISTINCT ?a; separator="|") AS ?alt) WHERE { VALUES ?p { ${v} }
  OPTIONAL { ?p rdfs:label ?fr FILTER(LANG(?fr) = "fr") } OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?p skos:altLabel ?a FILTER(LANG(?a) IN ("fr", "en")) } } GROUP BY ?p ?fr ?en`)) {
  const n = r.fr?.value ?? r.en?.value
  if (!n || /^Q\d+$/.test(n)) continue
  const alt = [...new Set([r.en?.value, ...(r.alt?.value.split('|') ?? [])])].filter((a) => a && a !== n && a.length <= 30).slice(0, 4)
  names.set(qid(r.p.value), { n, alt })
}

// 3. Team memberships with dates.
const spells = new Map()
for (const r of await batched('teams', ids, (v) => `SELECT ?p ?t ?s ?e WHERE { VALUES ?p { ${v} } ?p p:P54 ?st . ?st ps:P54 ?t .
  OPTIONAL { ?st pq:P580 ?s } OPTIONAL { ?st pq:P582 ?e } }`)) {
  const p = qid(r.p.value)
  spells.set(p, [...(spells.get(p) ?? []), { t: qid(r.t.value), s: year(r.s), e: year(r.e) }])
}

// 4. Teams: name and kind (senior club or senior national team).
const teamIds = [...new Set([...spells.values()].flat().map((s) => s.t))]
const teams = new Map()
for (const r of await batched('teaminfo', teamIds, (v) => `SELECT ?t ?fr ?en (GROUP_CONCAT(?k; separator="|") AS ?kinds) WHERE { VALUES ?t { ${v} }
  OPTIONAL { ?t rdfs:label ?fr FILTER(LANG(?fr) = "fr") } OPTIONAL { ?t rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?t wdt:P31 ?k } } GROUP BY ?t ?fr ?en`)) {
  const name = r.fr?.value ?? r.en?.value
  const kinds = r.kinds?.value ?? ''
  const nat = NATIONAL.some((k) => kinds.includes(`/${k}`))
  // Any other team counts as a club (FC Barcelone is typed "multi-sport club"), but "équipe de …" are youth / B national sides.
  if (!name || NOT_SENIOR.test(name) || NOT_SENIOR.test(r.en?.value ?? '') || (!nat && /^équipe /i.test(name))) continue
  teams.set(qid(r.t.value), { name: nat ? name.replace(/^équipe (de |d'|du |des )?|^Équipe (de |d'|du |des )?/, '').replace(/ de football$/, '') : name, nat })
}

// 5. Players: intervals in calendar years [start, end], played together when max(start) < min(end).
const ranked = ids.filter((id) => names.has(id)).sort((a, b) => fame.get(b) - fame.get(a))
const tier = (rank) => (rank < 400 ? 1 : rank < 3000 ? 2 : rank < 12000 ? 3 : 4)
const teamIndex = new Map()
const teamList = []
const ref = (t) => {
  if (!teamIndex.has(t)) {
    teamIndex.set(t, teamList.length)
    teamList.push([teams.get(t).name, teams.get(t).nat ? 1 : 0])
  }
  return teamIndex.get(t)
}
const players = []
ranked.forEach((id, rank) => {
  const own = (spells.get(id) ?? []).filter((s) => teams.has(s.t) && s.s !== null).sort((a, b) => a.s - b.s)
  const clubs = own.filter((s) => !teams.get(s.t).nat)
  // Club without end date: the next club move, or still there when recent, or a short spell.
  const clubEnd = (s) => Math.max(s.e ?? clubs.find((o) => o.s > s.s)?.s ?? (s.s >= NOW - 6 ? NOW + 1 : s.s + 1), s.s + 1)
  // National team without end date (the usual case): until the end of the club career.
  const careerEnd = Math.max(0, ...clubs.map(clubEnd))
  const flat = own.flatMap((s) => [ref(s.t), s.s, teams.get(s.t).nat ? Math.max(s.e ?? careerEnd, s.s + 1) : clubEnd(s)])
  if (!flat.length) return
  const { n, alt } = names.get(id)
  players.push(alt.length ? [id, n, tier(rank), flat, alt] : [id, n, tier(rank), flat])
})

writeFileSync(new URL('../src/content/footballers.json', import.meta.url), JSON.stringify({ source: 'Wikidata (CC0), propriété P54', built: new Date().toISOString().slice(0, 10), teams: teamList, players }))
console.log(`${players.length} players and ${teamList.length} teams written.`)
