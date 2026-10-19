import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GAMES, configFor, configKey, getGame, rulesFor } from '../src/core/catalog.ts'
import { daily, todayKey } from '../src/core/games/special.ts'
import { seeded } from '../src/core/rng.ts'
import { grade, orderRatio, scoreAnswer } from '../src/core/scoring.ts'
import { findAnswer, matches, normalize } from '../src/core/text.ts'
import type { Challenge, Config, Difficulty, Response } from '../src/core/types.ts'
import { content } from '../src/content/index.ts'

/** The perfect response to a challenge. */
function perfect(ch: Challenge): Response {
  switch (ch.kind) {
    case 'mcq': return { kind: 'mcq', choice: ch.answer }
    case 'text': return { kind: 'text', text: ch.display }
    case 'estimate': return { kind: 'estimate', value: ch.answer }
    case 'order': {
      const idx = ch.items.map((_, i) => i).sort((a, b) => (ch.dir === 'asc' ? ch.values[a] - ch.values[b] : ch.values[b] - ch.values[a]))
      return { kind: 'order', order: idx }
    }
    case 'list': return { kind: 'list', found: ch.answers.map((a) => a.n) }
    case 'rare': return { kind: 'rare', text: ch.answers.find((a) => a.tier === 4)?.n ?? ch.answers[0].n }
    case 'connections': return { kind: 'connections', solved: ch.groups.length, mistakes: 0 }
  }
}

function checkChallenge(ch: Challenge, where: string) {
  assert.ok(ch.id && ch.prompt, where)
  if (ch.kind === 'mcq') {
    assert.ok(ch.choices.length >= 2 && ch.answer >= 0 && ch.answer < ch.choices.length, `${where} mcq answer`)
    assert.equal(new Set(ch.choices.map(normalize)).size, ch.choices.length, `${where} duplicate choices: ${ch.choices}`)
    if (ch.choiceFlags) assert.equal(ch.choiceFlags.length, ch.choices.length)
  }
  if (ch.kind === 'text') {
    assert.ok(matches(ch.accept, ch.display, ch.exclusive), `${where} display not accepted: ${ch.display}`)
    if (ch.choices) assert.ok(ch.choices.includes(ch.display), `${where} choices miss answer`)
    for (const a of ch.accept) assert.ok(matches(ch.accept, a, ch.exclusive), `${where} alt not accepted: ${a}`)
  }
  if (ch.kind === 'order') assert.ok(ch.items.length >= 3 && ch.values.length === ch.items.length)
  if (ch.kind === 'estimate') assert.ok(ch.scale > 0)
  if (ch.kind === 'connections') assert.equal(ch.items.length, ch.groups.length * 4)
  const g = grade(ch, perfect(ch))
  assert.ok(g.correct, `${where}: perfect answer graded wrong (${ch.prompt})`)
}

test('every game generates valid challenges at every level and answer type', () => {
  for (const game of GAMES) {
    if (!game.generate) continue
    const diffs: Difficulty[] = game.options.difficulty ? [1, 2, 3, 4] : [configFor(game).difficulty]
    const answerTypes = game.options.answerType ?? ['qcm' as const]
    for (const difficulty of diffs) {
      for (const answerType of answerTypes) {
        const config: Config = { ...configFor(game), difficulty, answerType, hints: true }
        const list = game.generate({ content, config, rng: seeded(`${game.id}-${difficulty}-${answerType}`) })
        const where = `${game.id} d${difficulty} ${answerType}`
        assert.ok(list.length > 0, `${where}: empty game`)
        if (config.count > 0 && !['capital-chain', 'chronology', 'ranking'].includes(game.id)) {
          assert.ok(list.length >= Math.min(config.count, 3), `${where}: only ${list.length} challenges`)
        }
        assert.equal(new Set(list.map((c) => c.id)).size, list.length, `${where}: duplicate ids`)
        list.forEach((c) => checkChallenge(c, where))
      }
    }
  }
})

test('generation is reproducible with the same seed (daily / multiplayer fairness)', () => {
  const game = getGame('classic')!
  const a = game.generate!({ content, config: configFor(game), rng: seeded('x') })
  const b = game.generate!({ content, config: configFor(game), rng: seeded('x') })
  assert.deepEqual(a, b)
  const d1 = daily({ content, config: configFor(getGame('daily')!), rng: Math.random }, '2026-10-19')
  const d2 = daily({ content, config: configFor(getGame('daily')!), rng: Math.random, recent: new Set(['geo-001']) }, '2026-10-19')
  assert.deepEqual(d1, d2, 'daily depends only on the date')
  assert.equal(d1.length, 10)
  assert.notDeepEqual(d1, daily({ content, config: configFor(getGame('daily')!), rng: Math.random }, '2026-10-20'))
  assert.match(todayKey(new Date('2026-10-19T23:30:00Z')), /^2026-10-19$/)
})

test('typed answers: accents, case, articles and small typos, but no confusion between countries', () => {
  assert.ok(matches(['La Nouvelle-Orléans'], 'nouvelle orleans'))
  assert.ok(matches(['Pékin', 'Beijing'], 'BEIJING'))
  assert.ok(matches(['Copenhague'], 'Copenhage'))
  assert.ok(!matches(['Nigeria', 'Nigéria'], 'Niger', ['Niger']))
  assert.ok(!matches(['Autriche'], 'Australie', ['Australie']))
  assert.ok(matches(['Saint-Domingue'], 'st domingue'))
  assert.equal(findAnswer([['Mali'], ['Malte']], 'Malt'), 1)
  assert.equal(findAnswer([['Inde'], ['Indonésie']], 'Inde'), 0)
})

test('scoring: correctness dominates speed, difficulty multiplies, streaks are capped', () => {
  const ok = { ratio: 1, correct: true }
  const slow = scoreAnswer({ grade: ok, d: 1, timeMs: 15000, limitMs: 15000, streak: 1 })
  const fast = scoreAnswer({ grade: ok, d: 1, timeMs: 0, limitMs: 15000, streak: 1 })
  assert.equal(slow.total, 100)
  assert.equal(fast.total, 125)
  assert.equal(scoreAnswer({ grade: { ratio: 0, correct: false }, d: 4, timeMs: 0, limitMs: 1000, streak: 9 }).total, 0)
  assert.equal(scoreAnswer({ grade: ok, d: 4, timeMs: 15000, limitMs: 15000, streak: 1 }).total, 300)
  const long = scoreAnswer({ grade: ok, d: 1, timeMs: 15000, limitMs: 15000, streak: 50, rules: { streakStep: 0.1, streakCap: 0.5 } })
  assert.equal(long.streak, 50)
  // Unlimited time: speed measured against a 15 s reference, never negative.
  assert.equal(scoreAnswer({ grade: ok, d: 1, timeMs: 60000, limitMs: null, streak: 1 }).speed, 0)
  assert.equal(orderRatio([1, 2, 3], [0, 1, 2], 'asc'), 1)
  assert.equal(orderRatio([1, 2, 3], [2, 1, 0], 'asc'), 0)
})

test('rare answers score by tier; lists re-validate every entry', () => {
  const ch = getGame('rare')!.generate!({ content, config: { ...configFor(getGame('rare')!), difficulty: 1 }, rng: seeded('r') })[0]
  assert.equal(ch.kind, 'rare')
  if (ch.kind !== 'rare') return
  const common = ch.answers.find((a) => a.tier === 1)!
  assert.equal(grade(ch, { kind: 'rare', text: common.n }).fixedPoints, 10)
  assert.equal(grade(ch, { kind: 'rare', text: 'zzzz' }).correct, false)
  const list = getGame('listing')!.generate!({ content, config: configFor(getGame('listing')!), rng: seeded('l') })[0]
  if (list.kind !== 'list') return
  const g = grade(list, { kind: 'list', found: [list.answers[0].n, list.answers[0].n, 'n’importe quoi'] })
  assert.equal(g.fixedPoints, 20, 'duplicates and invalid entries never count')
})

test('settings: unknown values are reset, records only compare identical settings', () => {
  const game = getGame('classic')!
  const c = configFor(game, { difficulty: 3, questionTime: 7, count: 42, answerType: 'text' })
  assert.equal(c.difficulty, 3)
  assert.equal(c.questionTime, 15, 'invalid timer → default')
  assert.equal(c.count, 42, 'custom count allowed')
  assert.notEqual(configKey(game, c), configKey(game, { ...c, difficulty: 4 }))
  assert.notEqual(configKey(game, c), configKey(game, { ...c, questionTime: null }))
  const tf = getGame('truefalse')!
  assert.equal(configFor(tf, { answerType: 'text' }).answerType, 'qcm')
  assert.equal(rulesFor(getGame('higherlower')!, { ...configFor(getGame('higherlower')!), variant: 'survival' }).endOnError, true)
})
