import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SAVE_VERSION, addSession, defaultSave, parseSave } from '../src/lib/storage.ts'

test('missing save gives defaults without error', () => {
  assert.deepEqual(parseSave(null), { data: defaultSave(), error: null })
})

test('corrupt, invalid and future saves reset with an error', () => {
  for (const raw of ['{oops', '[]', '{"version":"1"}', JSON.stringify({ version: SAVE_VERSION + 1 })]) {
    const r = parseSave(raw)
    assert.deepEqual(r.data, defaultSave())
    assert.ok(r.error, raw)
  }
})

test('valid fields are kept, invalid ones dropped or defaulted', () => {
  const raw = JSON.stringify({
    version: SAVE_VERSION,
    settings: { questionCount: 15, secondsPerQuestion: 999 },
    records: {
      'quiz:all': { best: 900, plays: 3, totalCorrect: 20, totalAnswered: 30, lastPlayed: '2026-01-01T00:00:00Z', extra: 1 },
      'quiz:bad': { best: -5, plays: 1, totalCorrect: 0, totalAnswered: 0, lastPlayed: 'x' },
    },
    history: [{ key: 'quiz:all', score: 900, correct: 8, total: 10, date: '2026-01-01T00:00:00Z' }, { nope: true }],
  })
  const { data, error } = parseSave(raw)
  assert.equal(error, null)
  assert.deepEqual(data.settings, { questionCount: 15, secondsPerQuestion: 20 })
  assert.deepEqual(Object.keys(data.records), ['quiz:all'])
  assert.equal('extra' in data.records['quiz:all'], false)
  assert.equal(data.history.length, 1)
})

test('addSession tracks records and history', () => {
  const s = (score: number) => ({ key: 'quiz:all', score, correct: 5, total: 10, date: '2026-01-01T00:00:00Z' })
  let r = addSession(defaultSave(), s(500))
  assert.equal(r.isRecord, true)
  r = addSession(r.data, s(300))
  assert.equal(r.isRecord, false)
  assert.deepEqual(r.data.records['quiz:all'], { best: 500, plays: 2, totalCorrect: 10, totalAnswered: 20, lastPlayed: s(0).date })
  assert.equal(r.data.history[0].score, 300)
  assert.equal(addSession(defaultSave(), s(0)).isRecord, false)
})
