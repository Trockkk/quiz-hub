import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildRound, parseBank, pointsFor } from '../src/games/quiz/logic.ts'

const raw = JSON.parse(readFileSync(new URL('../src/data/quiz-general.json', import.meta.url), 'utf8'))

test('bundled question file is fully valid', () => {
  const bank = parseBank(raw)
  assert.equal(bank.questions.length, raw.questions.length)
  assert.equal(bank.categories.length, raw.categories.length)
})

test('invalid questions are dropped', () => {
  const bank = parseBank({
    categories: [{ id: 'a', label: 'A', icon: 'x', color: '#fff' }],
    questions: [
      { id: 'ok', category: 'a', question: 'Q ?', choices: ['1', '2'], answer: 1 },
      { id: 'ok', category: 'a', question: 'dup', choices: ['1', '2'], answer: 0 },
      { id: 'cat', category: 'zz', question: 'Q ?', choices: ['1', '2'], answer: 0 },
      { id: 'ans', category: 'a', question: 'Q ?', choices: ['1', '2'], answer: 2 },
      null,
    ],
  })
  assert.deepEqual(bank.questions.map((q) => q.id), ['ok'])
})

test('buildRound keeps the right answer after shuffling choices', () => {
  const pool = parseBank(raw).questions
  const round = buildRound(pool, 10)
  assert.equal(round.length, 10)
  assert.equal(new Set(round.map((q) => q.id)).size, 10)
  for (const q of round) {
    const original = pool.find((p) => p.id === q.id)!
    assert.equal(q.choices[q.answer], original.choices[original.answer])
    assert.deepEqual([...q.choices].sort(), [...original.choices].sort())
  }
  assert.equal(buildRound(pool, 999).length, pool.length)
})

test('pointsFor rewards speed', () => {
  assert.equal(pointsFor(false, 10_000, 10_000), 0)
  assert.equal(pointsFor(true, 10_000, 10_000), 200)
  assert.equal(pointsFor(true, 5_000, 10_000), 150)
  assert.equal(pointsFor(true, -50, 10_000), 100)
})
