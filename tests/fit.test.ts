import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adaptiveTdee, checkinProposal, closureDiff, dayCap, kcalAdherence, distributeDiff, exceptionDays, forecastDay, planBank, scaleMacros, type PlanDay } from '../lib/fit.ts'

const week = (base = 2140, start = '2026-11-05'): PlanDay[] => Array.from({ length: 7 }, (_, i) => ({ day: new Date(Date.parse(start + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10), base, current: 0 }))
const sum = (a: { kcal: number }[]) => a.reduce((x, y) => x + y.kcal, 0)

test('günlük tavan: %10 ile 250 kcal\'in küçüğü', () => {
  assert.equal(dayCap(2140), 214)
  assert.equal(dayCap(3000), 250)
  assert.equal(dayCap(1500), 150)
})

test('gün kapanışı kuralları', () => {
  assert.equal(closureDiff({ eaten: 0, target: 2000, burned: 0, items: 0 }).kind, 'untracked')
  assert.equal(closureDiff({ eaten: 1000, target: 2000, burned: 0, items: 3 }).kind, 'incomplete') // %50 < %60
  assert.deepEqual(closureDiff({ eaten: 2030, target: 2000, burned: 0, items: 5 }), { kind: 'balanced', diff: 0, raw: 30 })
  assert.deepEqual(closureDiff({ eaten: 2140, target: 2000, burned: 0, items: 5 }), { kind: 'over', diff: 140, raw: 140 })
  assert.deepEqual(closureDiff({ eaten: 1300, target: 2000, burned: 0, items: 5 }), { kind: 'under', diff: -300, raw: -700 }) // en fazla 300 kredi
  assert.equal(closureDiff({ eaten: 2300, target: 2000, burned: 320, items: 5 }).kind, 'balanced') // egzersiz kredisi
})

test('dağıtım: toplam korunur, yakın günler daha çok, hepsi negatif', () => {
  const r = distributeDiff(140, week(), 1500)
  assert.equal(sum(r.adjustments), -140)
  assert.equal(r.leftover, 0)
  const k = r.adjustments.map((a) => -a.kcal)
  for (let i = 1; i < k.length; i++) assert.ok(k[i] <= k[i - 1], 'azalan: ' + k)
  assert.equal(r.adjustments.length, 7)
})

test('dağıtım: az yenen gün → pozitif düzeltme', () => {
  const r = distributeDiff(-300, week(), 1500)
  assert.equal(sum(r.adjustments), 300)
  assert.ok(r.adjustments.every((a) => a.kcal > 0))
})

test('dağıtım: tavan ve taşma', () => {
  const r = distributeDiff(2000, week(), 1500) // 7 × 214 = 1498 sığar
  assert.equal(sum(r.adjustments), -1498)
  assert.equal(r.leftover, 502)
  assert.ok(r.adjustments.every((a) => a.kcal >= -214))
})

test('dağıtım: kalori tabanı ve korunan gün', () => {
  const days = week(1600)
  days[1].protected = true
  const r = distributeDiff(500, days, 1500)
  assert.ok(r.adjustments.every((a) => 1600 + a.kcal >= 1500), 'taban')
  assert.ok(!r.adjustments.some((a) => a.day === days[1].day), 'korunan gün')
  assert.equal(-sum(r.adjustments) + r.leftover, 500)
})

test('dağıtım: mevcut düzeltme kapasiteyi azaltır', () => {
  const days = week()
  days[0].current = -200
  const r = distributeDiff(140, days, 1500)
  const d0 = r.adjustments.find((a) => a.day === days[0].day)?.kcal ?? 0
  assert.ok(-d0 <= 14, 'ilk gün yalnızca 14 kcal daha düşebilir: ' + d0)
  assert.equal(sum(r.adjustments), -140)
})

test('istisna günü', () => {
  assert.equal(exceptionDays(800, 548), 2)
  assert.equal(exceptionDays(5000, 548), 3)
  assert.equal(exceptionDays(800, 0), 0)
})

test('kalori bankası', () => {
  const days = week(2140, '2026-11-05')
  const r = planBank({ today: '2026-11-04', eventDay: '2026-11-08', extra: 450, days, floor: 1500 })
  assert.ok(!('error' in r))
  if (!('error' in r)) {
    assert.equal(r.perDay, 150) // 5,6,7 Kasım
    assert.deepEqual(r.adjustments, [{ day: '2026-11-05', kcal: -150 }, { day: '2026-11-06', kcal: -150 }, { day: '2026-11-07', kcal: -150 }, { day: '2026-11-08', kcal: 450 }])
  }
  const tooMuch = planBank({ today: '2026-11-04', eventDay: '2026-11-06', extra: 600, days, floor: 1500 })
  assert.ok('error' in tooMuch)
  assert.ok('error' in planBank({ today: '2026-11-04', eventDay: '2026-11-04', extra: 300, days, floor: 1500 }))
})

test('makro ölçekleme: protein sabit', () => {
  assert.deepEqual(scaleMacros({ kcal: 2140, protein: 157, carb: 234, fat: 65 }, 2040), { kcal: 2040, protein: 157, carb: 219, fat: 61 })
})

test('adaptif harcama', () => {
  // 21 gün, her gün 2100 kcal, trend 80 → 79 kg: harcama = 2100 + 7700/20
  const days = Array.from({ length: 21 }, (_, i) => ({ day: new Date(Date.parse('2026-10-01T12:00:00Z') + i * 86400000).toISOString().slice(0, 10), intake: 2100, trend: 80 - i / 20 }))
  const r = adaptiveTdee(days)
  assert.equal(r.spanDays, 20)
  assert.equal(r.tdee, 2100 + 385)
  assert.equal(r.confidence, 'orta')
  assert.equal(adaptiveTdee(days.slice(0, 10)).tdee, null) // yetersiz veri
})

test('hedef tarih tahmini', () => {
  const s = Array.from({ length: 15 }, (_, i) => ({ day: new Date(Date.parse('2026-11-01T12:00:00Z') + i * 86400000).toISOString().slice(0, 10), kg: 80 - i * 0.1 }))
  const f = forecastDay(s, 78, '2026-11-15')
  assert.equal(f.kgPerWeek, -0.7)
  assert.equal(f.day, '2026-11-21') // 78.6 → 78: 6 gün
  assert.equal(forecastDay(s, 82, '2026-11-15').day, null) // yanlış yön
})

test('check-in önerisi: haftalık ±150 sınırı ve taban', () => {
  const a = checkinProposal({ currentKcal: 2140, measuredTdee: 2400, trendKg: 77, targetKg: 72, daysLeft: 70, floor: 1500, goal: 'lose' })
  // istenen = 2400 − 5×7700/70 = 1850 → 2140−150 = 1990
  assert.equal(a.kcal, 1990); assert.equal(a.delta, -150)
  const b = checkinProposal({ currentKcal: 1550, measuredTdee: 1700, trendKg: 70, targetKg: 60, daysLeft: 30, floor: 1500, goal: 'lose' })
  assert.equal(b.kcal, 1500)
  const c = checkinProposal({ currentKcal: 2140, measuredTdee: 2690, trendKg: 76, targetKg: 72, daysLeft: 56, floor: 1500, goal: 'lose' })
  assert.equal(c.delta, 0) // 2690 − 550 = 2140
})

test('kalori uyumu', () => {
  assert.equal(kcalAdherence(0, 2000), 0)
  assert.equal(kcalAdherence(2150, 2000), 1) // %7,5 sapma
  assert.equal(kcalAdherence(2400, 2000), 0.8) // %20 sapma
  assert.equal(kcalAdherence(1000, 2000), 0.2) // %50 sapma
  assert.equal(kcalAdherence(4000, 2000), 0)
})
