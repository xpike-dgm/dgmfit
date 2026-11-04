import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  effectiveMl, idealAt, cumulativeAt, pacePerHour, predict, distributionScore, frequentAmounts, isLikelyDuplicate,
  overHourlyLimit, computeStreak, longestGap, hourlyBuckets, goalForWeekday, calibrateSip, sipMl, parseHm, fmtHm, awakeWindow,
} from '../lib/water.ts'

const W = 7 * 60 + 30 // 07:30
const S = 23 * 60 + 30 // 23:30

test('hidrasyon katsayısı', () => {
  assert.equal(effectiveMl(200, 'water'), 200)
  assert.equal(effectiveMl(200, 'coffee'), 160)
  assert.equal(effectiveMl(250, 'tea'), 225)
})

test('saat ayrıştırma ve biçim', () => {
  assert.equal(parseHm('07:30', 0), 450)
  assert.equal(parseHm('bozuk', 99), 99)
  assert.equal(fmtHm(450), '07.30')
  assert.equal(fmtHm(1440 + 5), '00.05')
})

test('ideal eğri: uyanışta 0, uykudan 1 saat önce hedef', () => {
  assert.equal(idealAt(2500, W, S, W), 0)
  assert.equal(idealAt(2500, W, S, S - 60), 2500)
  assert.equal(idealAt(2500, W, S, S), 2500)
  // 07:30–22:30 arası 15 saat; 15:00'te yarısı
  assert.equal(idealAt(2500, W, S, 15 * 60), 1250)
})

test('gece yarısını geçen uyku saati', () => {
  assert.deepEqual(awakeWindow(8 * 60, 30), [480, 1470])
  // 00:10'da (ertesi gün) neredeyse hedef
  assert.ok(idealAt(2000, 8 * 60, 30, 10) > 1900)
})

test('kümülatif ve tempo', () => {
  const logs = [{ at: 480, ml: 250 }, { at: 600, ml: 500 }, { at: 900, ml: 300 }]
  assert.equal(cumulativeAt(logs, 600), 750)
  assert.equal(cumulativeAt(logs, 599), 250)
  assert.equal(pacePerHour(1050, W, W + 7 * 60), 150)
  assert.equal(pacePerHour(100, W, W + 5), 0)
})

test('tahmin: geçmiş yokken tempo, geçmişle ortalama', () => {
  const today = [{ at: 480, ml: 500 }, { at: 720, ml: 700 }]
  const p1 = predict(today, [], 2500, W, S, 13 * 60)
  assert.equal(p1.basis, 'tempo')
  assert.equal(p1.confidence, 'düşük')
  assert.ok(p1.endTotal > 1200)

  const day = [{ at: 480, ml: 500 }, { at: 720, ml: 500 }, { at: 960, ml: 800 }, { at: 1200, ml: 700 }]
  const past = Array.from({ length: 10 }, () => day)
  const p2 = predict(today, past, 2500, W, S, 13 * 60)
  assert.equal(p2.basis, 'geçmiş')
  assert.equal(p2.confidence, 'orta')
  assert.equal(p2.endTotal, 1200 + 1500) // bu saatten sonra geçmişte ortalama 1500 içilmiş
  assert.equal(p2.vsHistory, 200) // 13:00'te geçmiş ortalama 1000, bugün 1200
  assert.equal(p2.goalAt, 1200) // 20:00'deki 700 ile hedef aşılır
})

test('tahmin: hedef zaten tamam', () => {
  const p = predict([{ at: 600, ml: 2600 }], [], 2500, W, S, 700)
  assert.equal(p.goalAt, 700)
})

test('dağılım skoru: dengeli yüksek, akşam yığılması düşük', () => {
  const even = Array.from({ length: 15 }, (_, i) => ({ at: W + 30 + i * 60, ml: 160 }))
  const late = [{ at: 21 * 60, ml: 2400 }]
  const a = distributionScore(even, W, S)!
  const b = distributionScore(late, W, S)!
  assert.ok(a > 80, 'dengeli ' + a)
  assert.ok(b < 30, 'akşam ' + b)
  assert.equal(distributionScore([], W, S), null)
})

test('sık miktarlar: yakın saat ve yakın gün ağırlıklı', () => {
  const logs = [
    ...Array.from({ length: 5 }, () => ({ ml: 250, at: 600, daysAgo: 1 })),
    ...Array.from({ length: 5 }, () => ({ ml: 500, at: 480, daysAgo: 2 })),
    { ml: 100, at: 1200, daysAgo: 25 },
  ]
  assert.deepEqual(frequentAmounts(logs, 600, 2), [250, 500])
  assert.equal(frequentAmounts(logs, 1200, 3).length, 3)
})

test('çift kayıt ve saatlik sınır', () => {
  const now = Date.parse('2026-11-04T10:00:00Z')
  assert.equal(isLikelyDuplicate(250, now, [{ ml: 250, atMs: now - 60_000 }]), true)
  assert.equal(isLikelyDuplicate(250, now, [{ ml: 250, atMs: now - 5 * 60_000 }]), false)
  assert.equal(isLikelyDuplicate(200, now, [{ ml: 250, atMs: now - 30_000 }]), false)
  assert.equal(overHourlyLimit(500, now, [{ ml: 600, atMs: now - 20 * 60_000 }]), true)
  assert.equal(overHourlyLimit(500, now, [{ ml: 600, atMs: now - 70 * 60_000 }]), false)
})

test('esnek seri: ayda 2 dondurma', () => {
  const d = (day: string, total: number) => ({ day, total, goal: 2000 })
  const days = [d('2026-11-01', 2100), d('2026-11-02', 1000), d('2026-11-03', 2200), d('2026-11-04', 500)]
  const s = computeStreak(days)
  assert.equal(s.current, 2) // 1 ve 3 (2'si donduruldu), bugün henüz bitmedi
  assert.equal(s.frozenThisMonth, 1)
  assert.equal(s.freezesLeft, 1)
  assert.equal(s.todayDone, false)

  const broken = [d('2026-11-01', 2100), d('2026-11-02', 0), d('2026-11-03', 0), d('2026-11-04', 0), d('2026-11-05', 2500)]
  const b = computeStreak(broken)
  assert.equal(b.current, 1) // 3 kaçırılan gün: 2 dondurma yetmez, seri kırılır
  assert.equal(b.best, 1)
  assert.equal(b.todayDone, true)
})

test('en uzun ara ve saatlik kovalar', () => {
  const logs = [{ at: 480, ml: 200 }, { at: 540, ml: 200 }, { at: 840, ml: 300 }]
  const g = longestGap(logs, W, 900)
  assert.equal(g.minutes, 300)
  assert.equal(g.from, 540)
  const hb = hourlyBuckets(logs)
  assert.equal(hb[8], 200)
  assert.equal(hb[9], 200)
  assert.equal(hb[14], 300)
})

test('haftalık hedef ve yudum', () => {
  assert.equal(goalForWeekday(2500, [null, 3000, null, null, null, null, null], 1), 3000)
  assert.equal(goalForWeekday(2500, null, 3), 2500)
  assert.equal(calibrateSip(200, 9), 22)
  assert.equal(sipMl(null), 25)
  assert.equal(sipMl(22), 22)
  assert.throws(() => calibrateSip(200, 0))
})

import { goalForDay } from '../lib/water.ts'
test('hedef tarihçesi geçmişi bozmaz', () => {
  const h = [
    { effectiveFrom: '2026-11-01', baseMl: 2500, weekday: null },
    { effectiveFrom: '2026-11-10', baseMl: 3000, weekday: [null, null, null, null, null, null, 3500] },
  ]
  assert.equal(goalForDay(h, '2026-11-05'), 2500)
  assert.equal(goalForDay(h, '2026-11-10'), 3000) // Salı
  assert.equal(goalForDay(h, '2026-11-14'), 3500) // Cumartesi
  assert.equal(goalForDay(h, '2026-10-20'), 2500) // tarihçeden önce → ilk kayıt
})
