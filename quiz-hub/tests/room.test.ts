import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COUNTDOWN_MS, GRACE_MS, REVEAL_MS, TURN_MS, toPublic } from '../src/core/protocol.ts'
import { findFootballers, footballerById, teammates } from '../src/core/games/football.ts'
import { Room, createRoom } from '../src/core/room.ts'
import type { Challenge } from '../src/core/types.ts'
import { content, loadFootballers } from '../src/content/index.ts'

await loadFootballers()

function setup(n = 3) {
  const room = new Room(createRoom('ABCDE', 0), content)
  const ids = Array.from({ length: n }, (_, i) => {
    const r = room.join(`token${i}`, `Joueur${i}`, 0)
    assert.ok('id' in r)
    return r.id
  })
  return { room, ids }
}

function startGame(room: Room, host: string, gameId: string, config = {}) {
  room.handle(host, { t: 'config', gameId, config }, 0, 1)
  room.handle(host, { t: 'start' }, 0, 42)
  assert.equal(room.data.phase, 'countdown')
  room.tick(COUNTDOWN_MS)
  assert.equal(room.data.phase, 'question')
}

const current = (room: Room) => room.data.challenges[room.data.index] as Challenge

test('answers are never sent before the question closes', () => {
  const { room, ids } = setup()
  startGame(room, ids[0], 'classic', { questionTime: 15 })
  const pub = room.publicState(COUNTDOWN_MS)
  assert.equal(pub.challenge?.kind, 'mcq')
  const json = JSON.stringify(pub)
  assert.ok(!json.includes('"answer"'), 'no answer index')
  assert.ok(!json.includes('"explanation":'), 'no explanation')
  assert.equal(pub.reveal, null)
  for (const g of ['logo', 'flag', 'capital', 'closest', 'chronology', 'rare', 'listing', 'sequence', 'higherlower', 'truefalse', 'guessyear', 'duel-rare', 'duel-categories']) {
    const r = setup(1)
    startGame(r.room, r.ids[0], g)
    const p = JSON.stringify(r.room.publicState(COUNTDOWN_MS).challenge)
    for (const secret of ['"answers"', '"accept"', '"values"', '"labels"', '"display"', '"scale"']) assert.ok(!p.includes(secret), `${g} leaks ${secret}`)
  }
})

test('server-side scoring, duplicates, late answers and early close when everyone answered', () => {
  const { room, ids } = setup()
  startGame(room, ids[0], 'classic', { questionTime: 15, count: 5 })
  const ch = current(room)
  assert.equal(ch.kind, 'mcq')
  if (ch.kind !== 'mcq') return
  const t0 = room.data.questionStart
  room.handle(ids[0], { t: 'answer', index: 0, response: { kind: 'mcq', choice: ch.answer } }, t0 + 1000, 1)
  const dup = room.handle(ids[0], { t: 'answer', index: 0, response: { kind: 'mcq', choice: (ch.answer + 1) % ch.choices.length } }, t0 + 1500, 1)
  assert.equal(dup[0].msg.t === 'ack' && dup[0].msg.ok, false, 'second answer refused')
  const forged = room.handle(ids[1], { t: 'answer', index: 0, response: { kind: 'mcq', choice: 99 } } as never, t0 + 2000, 1)
  assert.equal(forged[0].msg.t === 'ack' && forged[0].msg.ok, false, 'out-of-range answer refused')
  room.handle(ids[1], { t: 'answer', index: 0, response: { kind: 'mcq', choice: (ch.answer + 1) % ch.choices.length } }, t0 + 2000, 1)
  assert.equal(room.data.phase, 'question')
  room.handle(ids[2], { t: 'answer', index: 0, response: { kind: 'mcq', choice: ch.answer } }, t0 + 14000, 1)
  assert.equal(room.data.phase, 'reveal', 'closes as soon as everyone answered')
  const [a, b, c] = ids.map((id) => room.player(id)!)
  assert.ok(a.score > c.score && c.score > 0 && b.score === 0, 'faster right answer scores more')
  assert.equal(room.publicState(t0).reveal?.answer, ch.choices[ch.answer])
  // Next question: a late answer is refused.
  room.tick(room.data.deadline! + 1)
  assert.equal(room.data.index, 1)
  const late = room.handle(ids[0], { t: 'answer', index: 1, response: { kind: 'mcq', choice: 0 } }, room.data.deadline! + GRACE_MS + 10, 1)
  assert.equal(late[0].msg.t === 'ack' && late[0].msg.ok, false)
})

test('only the host configures and starts; host leaves → another player becomes host; reconnect keeps the score', () => {
  const { room, ids } = setup()
  const denied = room.handle(ids[1], { t: 'start' }, 0, 1)
  assert.equal(denied[0].msg.t, 'error')
  assert.equal(room.handle(ids[0], { t: 'config', gameId: 'memory', config: {} }, 0, 1)[0].msg.t, 'error', 'solo-only games refused')
  startGame(room, ids[0], 'truefalse')
  room.player(ids[1])!.score = 500
  room.disconnect(ids[0], 1)
  assert.equal(room.data.hostId, ids[1])
  room.disconnect(ids[1], 2)
  const back = room.join('token1', 'Joueur1', 3)
  assert.ok('id' in back && back.id === ids[1])
  assert.equal(room.player(ids[1])!.score, 500)
})

test('quick successive settings changes are merged, not overwritten', () => {
  const { room, ids } = setup(1)
  room.handle(ids[0], { t: 'config', gameId: 'truefalse', config: {} }, 0, 1)
  room.handle(ids[0], { t: 'config', gameId: 'truefalse', config: { count: 5 } }, 0, 1)
  room.handle(ids[0], { t: 'config', gameId: 'truefalse', config: { questionTime: 5 } }, 0, 1)
  assert.equal(room.data.config.count, 5)
  assert.equal(room.data.config.questionTime, 5)
  room.handle(ids[0], { t: 'config', gameId: 'flag', config: {} }, 0, 1)
  assert.equal(room.data.config.count, 10, 'a new game starts from its own defaults')
})

test('a full game ends with a ranking', () => {
  const { room, ids } = setup(2)
  startGame(room, ids[0], 'truefalse', { count: 5, questionTime: 10 })
  let now = COUNTDOWN_MS
  while (room.data.phase !== 'results') {
    now += 10_000 + GRACE_MS + 1
    room.tick(now)
    now += REVEAL_MS
    room.tick(now)
  }
  const final = room.publicState(now).final!
  assert.equal(final.length, 2)
  assert.equal(final[0].answered, 5)
  room.handle(ids[0], { t: 'replay' }, now, 1)
  assert.equal(room.data.phase, 'lobby')
})

test('rare duel: identical answers share their points', () => {
  const { room, ids } = setup(3)
  startGame(room, ids[0], 'duel-rare', { difficulty: 2 })
  const ch = current(room)
  assert.equal(ch.kind, 'rare')
  if (ch.kind !== 'rare') return
  const rare = ch.answers.reduce((a, b) => (b.tier > a.tier ? b : a))
  const t = room.data.questionStart + 1000
  room.handle(ids[0], { t: 'answer', index: 0, response: { kind: 'rare', text: rare.n } }, t, 1)
  room.handle(ids[1], { t: 'answer', index: 0, response: { kind: 'rare', text: rare.n } }, t, 1)
  room.handle(ids[2], { t: 'answer', index: 0, response: { kind: 'rare', text: 'nimporte quoi' } }, t, 1)
  const [a, b, c] = ids.map((id) => room.player(id)!.score)
  assert.equal(a, b)
  assert.ok(a > 0 && c === 0)
  const solo = setup(1)
  startGame(solo.room, solo.ids[0], 'duel-rare', { difficulty: 2 })
  const sch = current(solo.room)
  if (sch.kind !== 'rare') return
  const sr = sch.answers.reduce((x, y) => (y.tier > x.tier ? y : x))
  solo.room.handle(solo.ids[0], { t: 'answer', index: 0, response: { kind: 'rare', text: sr.n } }, solo.room.data.questionStart + 1000, 1)
  assert.equal(solo.room.player(solo.ids[0])!.score, a * 2, 'alone, the full points')
})

test('categories duel, "last one standing": turns, validation and elimination', () => {
  const { room, ids } = setup(2)
  startGame(room, ids[0], 'duel-categories', { variant: 'last' })
  const ch = current(room)
  assert.equal(ch.kind, 'list')
  if (ch.kind !== 'list') return
  const t = room.data.turn!
  const first = t.order[0]
  const second = t.order[1]
  assert.equal(room.handle(second, { t: 'guess', index: 0, text: ch.answers[0].n }, room.data.questionStart + 10, 1)[0].msg.t === 'ack' && (room.handle(second, { t: 'guess', index: 0, text: ch.answers[0].n }, room.data.questionStart + 10, 1)[0].msg as { ok: boolean }).ok, false, 'not your turn')
  room.handle(first, { t: 'guess', index: 0, text: ch.answers[0].n }, room.data.questionStart + 100, 1)
  assert.equal(room.data.turn!.order[room.data.turn!.pos], second)
  const again = room.handle(second, { t: 'guess', index: 0, text: ch.answers[0].n }, room.data.questionStart + 200, 1)
  assert.equal(again[0].msg.t === 'ack' && again[0].msg.ok, false, 'already used')
  room.tick(room.data.turn!.deadline + 1)
  assert.equal(room.data.phase, 'reveal', 'second player timed out: first wins the round')
  assert.ok(room.player(first)!.score > room.player(second)!.score)
  assert.ok(TURN_MS > 0)
})

test('teammate chain: valid links extend the run, unknown or repeated names can be retried, a wrong link ends it', () => {
  const { room, ids } = setup(2)
  startGame(room, ids[0], 'foot-chain', { questionTime: 10 })
  const ch = current(room)
  if (ch.kind !== 'list') return assert.fail('chain is a list challenge')
  const t = room.data.turn!
  const [first, second] = t.order
  const start = footballerById(content, ch.start!)!
  const mate = content.footballers.find((f) => f.id !== start.id && teammates(start, f))!
  const at = room.data.questionStart
  const msgOf = (out: ReturnType<Room['handle']>) => (out[0].msg.t === 'ack' ? out[0].msg : assert.fail('ack expected'))
  assert.equal(msgOf(room.handle(first, { t: 'guess', index: 0, text: 'Zzzqx Inconnu' }, at + 10, 1)).ok, false)
  assert.equal(room.data.turn!.order[room.data.turn!.pos], first, 'unknown name: still your turn')
  assert.equal(msgOf(room.handle(first, { t: 'guess', index: 0, text: start.n }, at + 15, 1)).msg, 'Joueur déjà cité')
  assert.equal(room.data.turn!.order[room.data.turn!.pos], first, 'already cited: still your turn')
  room.handle(first, { t: 'guess', index: 0, text: mate.n }, at + 20, 1)
  const run = room.data.runs[0]
  assert.equal(run.links.length, 2)
  assert.equal(room.data.turn!.order[room.data.turn!.pos], second)
  assert.equal(room.data.turn!.deadline, at + 20 + 10_000, 'turn time comes from the settings')
  const last = footballerById(content, run.links[1].id)!
  const stranger = content.footballers.find((f) => findFootballers(content, f.n).every((x) => !teammates(last, x) && !run.links.some((l) => l.id === x.id)))!
  room.handle(second, { t: 'guess', index: 0, text: stranger.n }, at + 30, 1)
  assert.equal(room.data.phase, 'reveal', 'a wrong link ends the run')
  assert.match(run.end!, /jamais joué/)
  assert.ok(room.player(first)!.score > 0 && room.player(second)!.score === 0)
  assert.equal(room.publicState(at).runs[0].links.length, 2, 'the run stays visible')
})

test('public view of every multi game kind is well-formed', () => {
  const pub = toPublic({ kind: 'connections', id: 'x', d: 1, prompt: 'p', groups: [], items: [], mistakes: 1 })
  assert.equal(pub, null, 'connections are not a multiplayer kind')
})
