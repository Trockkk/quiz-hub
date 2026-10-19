// Extracts the SVG paths of the logos listed in src/content/logos.json from the simple-icons package
// into src/content/logo-paths.json, so the 5 MB package never reaches the browser bundle.
// Usage: npm run logos   (run again after adding a logo to logos.json)
import { readFileSync, writeFileSync } from 'node:fs'
import * as icons from 'simple-icons'

const logos = JSON.parse(readFileSync(new URL('../src/content/logos.json', import.meta.url), 'utf8'))
const bySlug = new Map(Object.values(icons).filter((i) => i?.slug).map((i) => [i.slug, i]))
const out = {}
const missing = []
for (const { slug } of logos) {
  const icon = bySlug.get(slug)
  if (icon) out[slug] = { path: icon.path, hex: icon.hex }
  else missing.push(slug)
}
writeFileSync(new URL('../src/content/logo-paths.json', import.meta.url), JSON.stringify(out))
console.log(`${Object.keys(out).length} logos written.`)
if (missing.length) {
  console.error(`Unknown simple-icons slugs: ${missing.join(', ')}`)
  process.exit(1)
}
