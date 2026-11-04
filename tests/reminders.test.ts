import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideReminder, ignoredStreak, type ReminderInput } from '../lib/reminders.ts'

const base = (o: Partial<ReminderInput> = {}): ReminderInput => ({
  now: 14 * 60, wake: 450, sleep: 1410, goal: 2500, total: 600, lastDrink: 11 * 60,
  sentToday: [], habit: Array(24).fill(100), hourStats: Array.from({ length: 24 }, () => ({ sent: 0, acted: 0 })),
  maxPerDay: 8, quiet: [], summaryEnabled: true, ...o,
})

test('geride ve uzun süredir içmemiş → hatırlat, ölçülü miktar', () => {
  const d = decideReminder(base())
  assert.equal(d.send, true)
  if (d.send) { assert.equal(d.kind, 'remind'); assert.ok(d.amount <= 400 && d.amount >= 150) }
})

test('su içildikten hemen sonra hatırlatma yok', () => {
  const d = decideReminder(base({ lastDrink: 14 * 60 - 10 }))
  assert.equal(d.send, false)
})

test('hedef tamamsa ve idealin çok önündeyse yok', () => {
  assert.equal(decideReminder(base({ total: 2600 })).send, false)
  assert.equal(decideReminder(base({ total: 2000, lastDrink: 600 })).send, false) // 14:00 ideal ~1083, çok önde
})

test('uyanık pencere dışı ve sessiz saat', () => {
  assert.equal(decideReminder(base({ now: 7 * 60 + 40 })).send, false) // uyanıştan 10 dk sonra
  assert.equal(decideReminder(base({ quiet: [[13 * 60, 15 * 60]] })).send, false)
})

test('günlük tavan ve minimum aralık', () => {
  const sent = Array.from({ length: 8 }, (_, k) => ({ at: 480 + k * 50, kind: 'remind' as const, acted: true }))
  assert.equal(decideReminder(base({ sentToday: sent })).send, false)
  assert.equal(decideReminder(base({ sentToday: [{ at: 14 * 60 - 20, kind: 'remind', acted: null }] })).send, false)
})

test('art arda 3 yok sayılan → 2 saat sessizlik', () => {
  const sent = [600, 700, 790].map((at) => ({ at, kind: 'remind' as const, acted: false }))
  assert.equal(ignoredStreak(sent), 3)
  assert.equal(decideReminder(base({ sentToday: sent, now: 860 })).send, false) // son bildirimden 70 dk
  assert.equal(decideReminder(base({ sentToday: sent, now: 920, lastDrink: 500 })).send, true) // 130 dk
})

test('sürekli yok sayılan saatte daha seyrek', () => {
  const hourStats = Array.from({ length: 24 }, () => ({ sent: 0, acted: 0 }))
  hourStats[14] = { sent: 10, acted: 0 }
  // 14:00, son içme 12:30 (90 dk) — normal aralık 90 dk, yok sayılan saatte 135 dk
  assert.equal(decideReminder(base({ lastDrink: 12 * 60 + 30, total: 900 })).send, true)
  assert.equal(decideReminder(base({ lastDrink: 12 * 60 + 30, total: 900, hourStats })).send, false)
})

test('unutmaya yatkın saatte daha erken', () => {
  const habit = Array(24).fill(100); habit[14] = 0
  // 70 dk önce içmiş, geride: normal 90 dk → bekler; unutulan saatte 67,5 dk → hatırlatır
  assert.equal(decideReminder(base({ lastDrink: 14 * 60 - 70, total: 900 })).send, false)
  assert.equal(decideReminder(base({ lastDrink: 14 * 60 - 70, total: 900, habit })).send, true)
})

test('gün sonu özeti bir kez', () => {
  const d = decideReminder(base({ now: 22 * 60 + 35, total: 1800, weakestHour: 14 }))
  assert.equal(d.send, true)
  if (d.send) { assert.equal(d.kind, 'summary'); assert.match(d.body, /%72/); assert.match(d.body, /14\.00/) }
  assert.equal(decideReminder(base({ now: 22 * 60 + 40, sentToday: [{ at: 22 * 60 + 35, kind: 'summary', acted: null }] })).send, false)
  assert.equal(decideReminder(base({ now: 22 * 60 + 35, summaryEnabled: false })).send, false)
})

test('mesajlar tekrar etmez', () => {
  const a = decideReminder(base())
  const b = decideReminder(base({ sentToday: [{ at: 600, kind: 'remind', acted: true }] }))
  assert.ok(a.send && b.send && a.title !== b.title)
})
