import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODES, applyMode, fasting, focusOn, mealLabel, modeDef, normalizeModes, postIftarProtein, ramadanMealFor, ramadanOn, ramadanWaterWindow, remindersQuiet, untilNext } from '../lib/modes.ts'
import { cardDef } from '../lib/cards/registry.ts'
import { decideReminder } from '../lib/reminders.ts'

test('mod tanımları kayıttaki kartlara işaret eder', () => {
  for (const m of MODES) for (const [screen, ids] of Object.entries({ ...m.front, ...m.hide })) for (const id of ids ?? []) {
    assert.equal(cardDef(id)?.screen, screen, `${m.id}: ${id}`)
    assert.ok(!cardDef(id)?.locked || cardDef(id)?.locked !== 'top', `${id} sabit başlık olamaz`)
  }
  assert.ok(modeDef('vacation')!.quiet && modeDef('vacation')!.pauseBalance && modeDef('sick')!.pauseBalance)
  assert.ok(!modeDef('training')!.pauseBalance && !modeDef('diet')!.quiet)
})

test('mod durumu doğrulama ve geçerlilik aralığı', () => {
  const s = normalizeModes({ focus: 'vacation', focusFrom: '2026-11-10', focusUntil: '2026-11-15', ramadan: true, sahur: '25:00', iftar: '18:05' })
  assert.equal(s.sahur, '04:45'); assert.equal(s.iftar, '18:05')
  assert.equal(focusOn(s, '2026-11-09'), null); assert.equal(focusOn(s, '2026-11-10')?.id, 'vacation'); assert.equal(focusOn(s, '2026-11-15')?.id, 'vacation'); assert.equal(focusOn(s, '2026-11-16'), null)
  assert.equal(normalizeModes({ focus: 'yok' as never }).focus, null)
  assert.equal(focusOn(normalizeModes({ focus: 'diet' }), '2030-01-01')?.id, 'diet', 'bitişsiz mod sürer')
  assert.ok(ramadanOn(normalizeModes({ ramadan: true, ramadanUntil: '2026-12-01' }), '2026-12-01'))
  assert.ok(!ramadanOn(normalizeModes({ ramadan: true, ramadanUntil: '2026-12-01' }), '2026-12-02'))
})

test('Ramazan: oruç saati, öğün adları, su penceresi, iftar sonrası protein', () => {
  const S = '04:45', I = '18:30'
  assert.ok(fasting(12 * 60, S, I)); assert.ok(!fasting(20 * 60, S, I)); assert.ok(!fasting(2 * 60, S, I)); assert.ok(fasting(4 * 60 + 45, S, I))
  assert.equal(mealLabel('breakfast', 'Kahvaltı', true), 'Sahur'); assert.equal(mealLabel('dinner', 'Akşam yemeği', true), 'İftar'); assert.equal(mealLabel('dinner', 'Akşam yemeği', false), 'Akşam yemeği')
  assert.equal(ramadanMealFor(18 * 60 + 40, S, I), 'dinner'); assert.equal(ramadanMealFor(21 * 60, S, I), 'snack'); assert.equal(ramadanMealFor(3 * 60 + 30, S, I), 'breakfast')
  assert.deepEqual(untilNext(17 * 60 + 30, S, I), { to: 'iftar', min: 60 }); assert.deepEqual(untilNext(23 * 60, S, I), { to: 'sahur', min: 345 })
  assert.equal(postIftarProtein(19 * 60, I, 40, 110), 70); assert.equal(postIftarProtein(23 * 60 + 30, I, 40, 110), null); assert.equal(postIftarProtein(19 * 60, I, 108, 110), null)
  // su penceresi gece yarısını aşar: hatırlatma motoru iftar–sahur arasında çalışır, oruçta susar
  const w = ramadanWaterWindow(S, I)
  const base = { goal: 2400, total: 0, lastDrink: null, sentToday: [], habit: Array(24).fill(0), hourStats: Array.from({ length: 24 }, () => ({ sent: 0, acted: 0 })), maxPerDay: 8, quiet: [] as [number, number][], summaryEnabled: false, ...w }
  assert.equal(decideReminder({ ...base, now: 13 * 60 }).send, false, 'oruçta su hatırlatması yok')
  assert.equal(decideReminder({ ...base, now: 21 * 60 }).send, true, 'iftardan sonra hatırlatma var')
  assert.equal(decideReminder({ ...base, now: 1 * 60 }).send, true, 'gece yarısından sonra sahura kadar sürer')
})

test('hatırlatma susturma: tatil/hastalık her şey, Ramazan yalnız oruçta öğün', () => {
  const day = '2026-11-10'
  assert.ok(remindersQuiet(normalizeModes({ focus: 'sick' }), day, 600, 'water'))
  assert.ok(!remindersQuiet(normalizeModes({ focus: 'training' }), day, 600, 'water'))
  const r = normalizeModes({ ramadan: true })
  assert.ok(remindersQuiet(r, day, 13 * 60, 'meal')); assert.ok(!remindersQuiet(r, day, 21 * 60, 'meal')); assert.ok(!remindersQuiet(r, day, 13 * 60, 'water'))
})

test('düzene mod uygulama: gizle, öne al, yoksa ekle, başlık sabit', () => {
  const items = ['today.header', 'today.macros', 'today.goal-choice', 'today.fit', 'today.water', 'today.training', 'today.coach'].map((id) => ({ id }))
  const top = (id: string) => cardDef(id)?.locked === 'top'
  const sick = applyMode('today', items, modeDef('sick'), (id) => ({ id }), top).map((i) => i.id)
  assert.deepEqual(sick, ['today.header', 'today.water', 'today.macros', 'today.coach'])
  const tr = applyMode('today', items, modeDef('training'), (id) => (cardDef(id) ? { id } : null), top).map((i) => i.id)
  assert.deepEqual(tr.slice(0, 4), ['today.header', 'today.training', 'today.post-protein', 'today.macros'])
  assert.equal(new Set(tr).size, tr.length, 'tekrar yok')
  assert.deepEqual(applyMode('today', items, null, (id) => ({ id }), top), items)
})
