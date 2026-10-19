import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_CONFIG } from '../src/core/catalog.ts'
import { answer, gameDeadline, next, questionDeadline, secure, start, stop, summarize, timeUp, timeoutResponse, type EngineState } from '../src/core/engine.ts'
import { LADDER } from '../src/core/scoring.ts'
import type { Challenge, Config, Rules } from '../src/core/types.ts'

const q = (i: number): Challenge => ({ kind: 'mcq', id: `q${i}`, d: 1, theme: 'geo', prompt: `Q${i}`, choices: ['a', 'b'], answer: 0 })
const qs = (n: number) => Array.from({ length: n }, (_, i) => q(i))
const ok = { kind: 'mcq' as const, choice: 0 }
const ko = { kind: 'mcq' as const, choice: 1 }

function play(s: EngineState, responses: ({ kind: 'mcq'; choice: number } | null)[], config: Config, rules: Rules) {
  for (const r of responses) {
    s = answer(s, r, { config, rules, now: s.questionStart + 1000 })
    s = next(s, s.questionStart + 2000)
  }
  return s
}

test('normal game: score, streaks, end after the last question', () => {
  const config = { ...DEFAULT_CONFIG, questionTime: 10 }
  let s = start(qs(3), { config, rules: {}, now: 0 })
  s = play(s, [ok, ko, ok], config, {})
  assert.equal(s.phase, 'over')
  assert.equal(s.endReason, 'done')
  const sum = summarize(s)
  assert.equal(sum.correct, 2)
  assert.equal(sum.answered, 3)
  assert.equal(sum.bestStreak, 1)
  assert.deepEqual(sum.perTheme.geo, [2, 3])
  assert.ok(sum.score > 200 && sum.score <= 250)
})

test('unlimited question time: no deadline; unlimited total time: no game deadline', () => {
  const config = { ...DEFAULT_CONFIG, questionTime: null, totalTime: null }
  const s = start(qs(2), { config, rules: {}, now: 0 })
  assert.equal(questionDeadline(s, config), null)
  assert.equal(gameDeadline(s, config), null)
  const timed = { ...config, questionTime: 5, totalTime: 60 }
  assert.equal(questionDeadline(s, timed), 5000)
  assert.equal(gameDeadline(s, timed), 60000)
})

test('survival ends at the first mistake, after its feedback', () => {
  const rules = { endOnError: true }
  let s = start(qs(10), { config: DEFAULT_CONFIG, rules, now: 0 })
  s = answer(s, ok, { config: DEFAULT_CONFIG, rules, now: 10 })
  s = next(s, 20)
  s = answer(s, null, { config: DEFAULT_CONFIG, rules, now: 30 })
  assert.equal(s.phase, 'feedback', 'the correction is shown first')
  s = next(s, 40)
  assert.equal(s.endReason, 'error')
  assert.equal(summarize(s).correct, 1)
})

test('lives: the boss ends after 3 mistakes', () => {
  const rules = { lives: 3 }
  const s = play(start(qs(10), { config: DEFAULT_CONFIG, rules, now: 0 }), [ko, ok, ko, ko, ok], DEFAULT_CONFIG, rules)
  assert.equal(s.endReason, 'lives')
  assert.equal(s.turns.length, 4)
})

test('ladder: securing, falling back after a mistake, stopping', () => {
  const rules = { ladder: true }
  let s = start(qs(12), { config: DEFAULT_CONFIG, rules, now: 0 })
  s = play(s, [ok, ok, ok], DEFAULT_CONFIG, rules)
  assert.equal(s.score, LADDER[2])
  s = secure(s)
  assert.equal(s.ladder!.secured, LADDER[2])
  s = play(s, [ok, ko], DEFAULT_CONFIG, rules)
  assert.equal(s.endReason, 'error')
  assert.equal(s.score, LADDER[2], 'falls back to the secured amount')
  let t = play(start(qs(12), { config: DEFAULT_CONFIG, rules, now: 0 }), [ok, ok], DEFAULT_CONFIG, rules)
  t = stop(t)
  assert.equal(t.score, LADDER[1])
  assert.equal(t.endReason, 'stopped')
})

test('time up ends the game without counting the open question; timeouts keep partial lists', () => {
  let s = start(qs(5), { config: DEFAULT_CONFIG, rules: {}, now: 0 })
  s = timeUp(s)
  assert.equal(s.endReason, 'time')
  assert.equal(summarize(s).answered, 0)
  const list: Challenge = { kind: 'list', id: 'l', d: 1, prompt: 'p', answers: [{ n: 'a' }] }
  assert.deepEqual(timeoutResponse(list, { kind: 'list', found: ['a'] }), { kind: 'list', found: ['a'] })
  assert.equal(timeoutResponse(q(1), ok), null, 'a selected but unconfirmed answer does not count')
})

test('answers are ignored outside the question phase (no double submission)', () => {
  let s = start(qs(2), { config: DEFAULT_CONFIG, rules: {}, now: 0 })
  s = answer(s, ok, { config: DEFAULT_CONFIG, rules: {}, now: 10 })
  const again = answer(s, ok, { config: DEFAULT_CONFIG, rules: {}, now: 20 })
  assert.equal(again, s)
})
