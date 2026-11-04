import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeBadges, waterInsights, type InsightDay } from '../lib/water-insights.ts'

function mkDays(n: number, f: (i: number, day: string) => Partial<InsightDay>): InsightDay[] {
  const start = Date.parse('2026-10-01T12:00:00Z') // Perşembe
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(start + i * 86400000).toISOString().slice(0, 10)
    return { day, total: 2500, goal: 2500, count: 8, firstAt: 480, ...f(i, day) }
  })
}
const hourly = () => { const h = Array(24).fill(200); h[14] = 10; h[15] = 10; h[16] = 10; return h }
const base = { wake: 450, sleep: 1410, reminders: { sent: 0, acted: 0, bestHour: null } }

test('en zayıf dilim: 14.00–17.00', () => {
  const r = waterInsights({ ...base, days: mkDays(30, () => ({})), hourlyAvg14: hourly() })
  const w = r.find((x) => x.id === 'weak-window')
  assert.ok(w); assert.match(w!.text, /14\.00–17\.00/)
})

test('haftalık düşüş uyarısı', () => {
  const days = mkDays(30, (i) => ({ total: i >= 22 ? 1500 : 2500 }))
  const r = waterInsights({ ...base, days, hourlyAvg14: Array(24).fill(120) })
  assert.ok(r.find((x) => x.id === 'trend-down'))
  assert.equal(r[0].tone, 'warn') // uyarılar önce
})

test('en zayıf gün', () => {
  // Cumartesi günleri hep hedef altında
  const days = mkDays(29, (_, day) => (new Date(day + 'T12:00:00Z').getUTCDay() === 6 ? { total: 1000 } : {}))
  const r = waterInsights({ ...base, days, hourlyAvg14: Array(24).fill(120) }, 6)
  const w = r.find((x) => x.id === 'weak-weekday')
  assert.ok(w); assert.match(w!.text, /^Cumartesi/)
})

test('sabah ilk suyun kayması', () => {
  const days = mkDays(29, (i) => ({ firstAt: i >= 21 ? 600 : 480 }))
  const r = waterInsights({ ...base, days, hourlyAvg14: Array(24).fill(120) }, 6)
  assert.ok(r.find((x) => x.id === 'morning-shift'))
})

test('istikrar ve hatırlatma etkinliği', () => {
  const r = waterInsights({ ...base, days: mkDays(30, () => ({})), hourlyAvg14: Array(24).fill(120), reminders: { sent: 20, acted: 12, bestHour: 15 } }, 6)
  assert.ok(r.find((x) => x.id === 'consistent'))
  assert.match(r.find((x) => x.id === 'reminders-work')!.text, /%60.*15\.00/)
})

test('veri azken içgörü üretmez', () => {
  const r = waterInsights({ ...base, days: mkDays(3, () => ({})), hourlyAvg14: hourly() })
  assert.equal(r.length, 0)
})

test('rozetler ve kazanılma günleri', () => {
  const days = mkDays(45, (i) => (i < 2 ? { total: 0, count: 0, firstAt: null } : {}))
  const b = Object.fromEntries(computeBadges(days, 450).map((x) => [x.id, x.earnedDay]))
  assert.equal(b['first-log'], '2026-10-03')
  assert.equal(b['first-goal'], '2026-10-03')
  assert.equal(b['streak-7'], '2026-10-09')
  assert.equal(b['streak-30'], '2026-11-01')
  assert.equal(b['early-bird'], '2026-10-07')
  assert.equal(b['perfect-week'], '2026-10-11') // ilk tam Pt–Pz haftası: 5–11 Ekim
  assert.equal(b['liters-100'], '2026-11-11') // 40 gün × 2,5 L
})
