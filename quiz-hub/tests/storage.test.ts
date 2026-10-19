import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SAVE_VERSION, addDaily, addSession, defaultSave, parseSave, type SessionInput } from '../src/lib/storage.ts'

const session = (score: number, extra: Partial<SessionInput> = {}): SessionInput => ({
  key: 'classic|d2|n10', gameId: 'classic', portal: 'culture', score, correct: 5, answered: 10, avgMs: 3000, bestStreak: 3, d: 2,
  date: '2026-01-01T00:00:00Z', label: 'Normal · 10 questions', perTheme: { geo: [2, 3] }, timeMs: 30000, seen: ['geo-001'], ...extra,
})

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

test('v1 saves (first version of the site) are migrated without losing records', () => {
  const v1 = JSON.stringify({
    version: 1,
    settings: { questionCount: 15, secondsPerQuestion: 30 },
    records: { 'quiz:all': { best: 900, plays: 3, totalCorrect: 20, totalAnswered: 30, lastPlayed: '2026-01-01T00:00:00Z' } },
    history: [{ key: 'quiz:all', score: 900, correct: 8, total: 10, date: '2026-01-01T00:00:00Z' }],
  })
  const { data, error } = parseSave(v1)
  assert.equal(error, null)
  assert.equal(data.version, SAVE_VERSION)
  assert.deepEqual(data.prefs.classic, { count: 15, questionTime: 30 })
  assert.equal(data.records['classic|legacy|all'].best, 900)
  assert.equal(data.stats.all.plays, 3)
  assert.equal(data.history.length, 1)
})

test('invalid fields are dropped, valid ones kept', () => {
  const raw = JSON.stringify({
    ...defaultSave(),
    prefs: { classic: { difficulty: 9, count: 15, questionTime: null, answerType: 'hack', themes: ['geo', 3] } },
    records: { ok: { best: 1, plays: 1, bestStreak: 0, lastPlayed: '2026-01-01T00:00:00Z', label: 'x' }, bad: { best: -1 } },
    stats: { all: { plays: 1, correct: 1, answered: 1, timeMs: 1, bestStreak: 1 }, bad: { plays: 'x' } },
    daily: { last: 'nope', streak: 2, best: 2, results: { '2026-01-01': { score: 10, grid: '🟩' } } },
  })
  const { data } = parseSave(raw)
  assert.deepEqual(data.prefs.classic, { count: 15, questionTime: null, themes: ['geo'] })
  assert.deepEqual(Object.keys(data.records), ['ok'])
  assert.deepEqual(Object.keys(data.stats), ['all'])
  assert.equal(data.daily.last, null)
  assert.equal(data.daily.results['2026-01-01'].score, 10)
})

test('addSession: records per settings, aggregated stats, recently seen questions', () => {
  let r = addSession(defaultSave(), session(500))
  assert.equal(r.isRecord, true)
  assert.equal(r.previousBest, null)
  r = addSession(r.data, session(300))
  assert.equal(r.isRecord, false)
  assert.equal(r.previousBest, 500)
  const d = r.data
  assert.equal(d.records['classic|d2|n10'].best, 500)
  assert.equal(d.records['classic|d2|n10'].plays, 2)
  assert.equal(d.stats.all.plays, 2)
  assert.equal(d.stats['portal:culture'].correct, 10)
  assert.deepEqual([d.stats['theme:geo'].correct, d.stats['theme:geo'].answered], [4, 6])
  assert.deepEqual(d.recent, ['geo-001'])
  assert.equal(d.history[0].score, 300)
  assert.equal(addSession(defaultSave(), session(0)).isRecord, false)
})

test('daily challenge: one result per day, streak of consecutive days', () => {
  let d = addDaily(defaultSave(), '2026-01-01', 100, '🟩')
  d = addDaily(d, '2026-01-01', 999, '🟥')
  assert.equal(d.daily.results['2026-01-01'].score, 100, 'only the first game of the day counts')
  d = addDaily(d, '2026-01-02', 50, '🟩')
  assert.equal(d.daily.streak, 2)
  d = addDaily(d, '2026-01-05', 50, '🟩')
  assert.equal(d.daily.streak, 1, 'a missed day resets the streak')
  assert.equal(d.daily.best, 2)
})
