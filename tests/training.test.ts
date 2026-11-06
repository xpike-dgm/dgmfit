import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardioKcal, cleanNumInput, rirText, detectPRs, e1rm, platesFor, roundTo, sessionRecords, strengthKcal, suggestNext, warmupSets, weightFor, workoutWaterBonus, type LoggedSet, type Session } from '../lib/training.ts'

const S = (kg: number, reps: number, rir: number | null = 2, type: LoggedSet['type'] = 'normal'): LoggedSet => ({ kg, reps, rir, type })
const sess = (day: string, ...sets: LoggedSet[]): Session => ({ day, sets })
const T = { repMin: 8, repMax: 12, rir: 2 }

test('e1RM ve spesifikasyon örneği', () => {
  assert.equal(e1rm(80, 8, 2), 106.67) // 80 × (1 + 10/30)
  assert.equal(roundTo(weightFor(106.67, 8, 1), 2.5), 82.5) // 82,05 → 82,5
  assert.equal(e1rm(140, 1, 0), 140)
  assert.equal(e1rm(0, 5, 0), 0)
})

test('öneri: çift aşamalı ilerleme (tüm setler üst sınırda → +2,5 kg, tekrar alt sınıra)', () => {
  const r = suggestNext({ history: [sess('2026-11-01', S(80, 12), S(80, 12), S(80, 12))], target: T, kind: 'weight_reps' })!
  assert.equal(r.kg, 82.5); assert.equal(r.reps, 8); assert.equal(r.rule, 'progress'); assert.equal(r.confidence, 'düşük')
})

test('öneri: aralık içinde aynı ağırlık + 1 tekrar; ağırlık düşmez', () => {
  const r = suggestNext({ history: [sess('d', S(80, 9), S(80, 8))], target: T, kind: 'weight_reps' })!
  assert.deepEqual([r.kg, r.reps, r.rule], [80, 10, 'double'])
})

test('öneri: yedekte çok tekrar kaldıysa bir kademe artış', () => {
  // 80 × 8 @ RIR 4 → e1RM 112; 9 tekrar @ RIR 1 → 84 → 82,5
  const r = suggestNext({ history: [sess('d', S(80, 8, 4))], target: { repMin: 8, repMax: 12, rir: 1 }, kind: 'weight_reps' })!
  assert.deepEqual([r.kg, r.reps], [82.5, 9])
})

test('öneri: aralığın altında kalınca e1RM ile hafifletir (en fazla iki kademe)', () => {
  // 80 × 6 @ RIR 0 → e1RM 96; 8 tekrar @ RIR 1 → 73,8 → 72,5; sınır 80 − 5 = 75
  const r = suggestNext({ history: [sess('d', S(80, 6, 0))], target: { repMin: 8, repMax: 12, rir: 1 }, kind: 'weight_reps' })!
  assert.deepEqual([r.kg, r.reps], [75, 8])
})

test('yorgunluk: bir düşüşte sabit, art arda iki düşüşte %10 deload', () => {
  const hold = suggestNext({ history: [sess('a', S(100, 5, 1)), sess('b', S(100, 5, 1)), sess('c', S(100, 4, 0))], target: { repMin: 3, repMax: 6, rir: 1 }, kind: 'weight_reps' })!
  assert.deepEqual([hold.rule, hold.kg, hold.reps], ['hold', 100, 4])
  // 123,33 → 116,67 (−%5,4) → 107,67 (−%7,7)
  const dl = suggestNext({ history: [sess('a', S(100, 6, 1)), sess('b', S(100, 5, 0)), sess('c', S(95, 4, 0))], target: { repMin: 3, repMax: 6, rir: 1 }, kind: 'weight_reps' })!
  assert.deepEqual([dl.rule, dl.kg, dl.reps, dl.rir], ['deload', 85, 3, 2])
  assert.equal(dl.confidence, 'orta')
})

test('bağlam: büyük kalori açığı ya da ağrı notu artışı durdurur', () => {
  const h = [sess('d', S(80, 12), S(80, 12))]
  assert.deepEqual(((r) => [r.kg, r.reps, r.rule])(suggestNext({ history: h, target: T, kind: 'weight_reps', deficitKcal: 800 })!), [80, 12, 'cautious'])
  assert.equal(suggestNext({ history: h, target: T, kind: 'weight_reps', deficitKcal: 550 })!.kg, 82.5) // dengeli tempo açığı temkin gerektirmez
  assert.equal(suggestNext({ history: [{ ...h[0], pain: true }], target: T, kind: 'weight_reps' })!.rule, 'cautious')
})

test('reddetme geri bildirimi bir kademe kaydırır; güven düzeyi', () => {
  const h = [sess('d', S(80, 8, 4))]
  const t = { repMin: 8, repMax: 12, rir: 1 }
  assert.equal(suggestNext({ history: h, target: t, kind: 'weight_reps', feedback: { tooHeavy: 3, tooLight: 0 } })!.kg, 80)
  const six = Array.from({ length: 6 }, (_, i) => sess(String(i), S(80, 9)))
  assert.equal(suggestNext({ history: six, target: T, kind: 'weight_reps' })!.confidence, 'yüksek')
  assert.equal(suggestNext({ history: [], target: T, kind: 'weight_reps' }), null)
  assert.equal(suggestNext({ history: [sess('d', S(20, 8, 2, 'warmup'))], target: T, kind: 'weight_reps' }), null) // ısınma sayılmaz
})

test('vücut ağırlığı, destekli ve süreli hareketler', () => {
  const pu = { repMin: 6, repMax: 10, rir: 1 }
  assert.deepEqual(((r) => [r.kg, r.reps, r.rule])(suggestNext({ history: [sess('d', S(0, 10), S(0, 10))], target: pu, kind: 'bodyweight' })!), [2.5, 6, 'progress'])
  assert.deepEqual(((r) => [r.kg, r.reps])(suggestNext({ history: [sess('d', S(0, 8), S(0, 7))], target: pu, kind: 'bodyweight' })!), [0, 9])
  assert.equal(suggestNext({ history: [sess('d', S(20, 10), S(20, 10))], target: pu, kind: 'assisted' })!.kg, 17.5)
  const plank = suggestNext({ history: [sess('d', { kg: 0, reps: 1, rir: null, type: 'normal', seconds: 45 })], target: pu, kind: 'time' })!
  assert.match(plank.reason, /50 sn/)
})

test('plaka hesaplayıcı', () => {
  assert.deepEqual(platesFor(100), { perSide: [25, 15], achieved: 100, remainder: 0 })
  assert.deepEqual(platesFor(102.5), { perSide: [25, 15, 1.25], achieved: 102.5, remainder: 0 })
  assert.deepEqual(platesFor(101), { perSide: [25, 15], achieved: 100, remainder: 1 })
  assert.deepEqual(platesFor(60, 20, [20, 10, 5]), { perSide: [20], achieved: 60, remainder: 0 })
  assert.deepEqual(platesFor(20).perSide, [])
})

test('ısınma setleri %40 / %60 / %80', () => {
  assert.deepEqual(warmupSets(100), [{ kg: 40, reps: 8, pct: 40 }, { kg: 60, reps: 5, pct: 60 }, { kg: 80, reps: 3, pct: 80 }])
  assert.deepEqual(warmupSets(40).map((w) => w.kg), [20, 22.5, 30])
  assert.deepEqual(warmupSets(20), [])
})

test('rekorlar: ilk kayıt rekor değil; kırılanlar', () => {
  const prev = sessionRecords([S(100, 5, 1), S(100, 5, 1)], 'weight_reps')
  assert.deepEqual(prev, { kg: 100, e1rm: 120, rm3: 100, rm5: 100, rm10: 0, reps: 5, volume: 1000 })
  const cur = sessionRecords([S(102.5, 3, 1), S(90, 10, 0), S(20, 10, 0, 'warmup')], 'weight_reps')
  assert.deepEqual(detectPRs(prev, cur, 'weight_reps').map((p) => p.type), ['kg', 'rm10', 'reps', 'volume']) // 3RM = en ağır (102,5) olduğu için tekrar edilmez
  assert.deepEqual(detectPRs(null, cur, 'weight_reps'), [])
  // ilk kayıt yalnızca ısınma/başarısız setlerden oluştuysa (tüm değerler 0) sonraki seans rekor yağmuru üretmez
  const zero = sessionRecords([S(20, 8, 0, 'warmup'), S(100, 0, null)], 'weight_reps')
  assert.ok(Object.values(zero).every((v) => v === 0)); assert.deepEqual(detectPRs(zero, cur, 'weight_reps'), [])
})

test('destekli hareket: etkin yük (vücut − destek), destek azalınca rekor; eski negatif kayıtla kıyas yok', () => {
  const a = sessionRecords([S(30, 8, 2)], 'assisted', 80), b = sessionRecords([S(10, 8, 2)], 'assisted', 80)
  assert.equal(a.kg, 50); assert.equal(b.kg, 70)
  assert.deepEqual(detectPRs(a, b, 'assisted').map((p) => p.type), ['kg', 'volume']) // daha az destek = daha çok etkin yük ve hacim
  assert.deepEqual(detectPRs({ ...a, kg: -30 }, b, 'assisted').map((p) => p.type), ['volume']) // eski negatif kg ile kıyas yok
})

test('yuvarlama: yukarı yuvarlamada tam kat bir adım atlamaz', () => {
  assert.equal(roundTo(100, 2.5, 'up'), 100); assert.equal(roundTo(100.1, 2.5, 'up'), 102.5); assert.equal(roundTo(101.2, 2.5, 'down'), 100)
})

test('kalori: ACSM koşu, Keytel nabız, MET tablosu, ağırlık antrenmanı', () => {
  // 5 km / 30 dk, 70 kg: 166,7 m/dk → VO2 36,83 → MET 10,52 → brüt 368, net 368,3 − 35 = 333
  assert.deepEqual(cardioKcal({ type: 'run', minutes: 30, weightKg: 70, distanceKm: 5 }), { gross: 368, net: 333, method: 'acsm', met: 10.5 })
  // Erkek, 150 atım, 80 kg, 30 yaş: 14,697 kcal/dk × 30 = 441, net 401
  const hr = cardioKcal({ type: 'bike', minutes: 30, weightKg: 80, avgHr: 150, sex: 'male', age: 30 })
  assert.deepEqual([hr.gross, hr.net, hr.method], [441, 401, 'nabız'])
  assert.deepEqual(cardioKcal({ type: 'bike', minutes: 60, weightKg: 70 }), { gross: 476, net: 406, method: 'met', met: 6.8 })
  assert.deepEqual(strengthKcal(60, 80, 20), { gross: 280, net: 200, met: 3.5 })
  assert.deepEqual(strengthKcal(40, 80, 20), { gross: 320, net: 267, met: 6 })
})

test('antrenman günü su eki: saat başına 500 ml', () => {
  assert.equal(workoutWaterBonus(60), 500)
  assert.equal(workoutWaterBonus(45), 400) // 375 → 400
  assert.equal(workoutWaterBonus(90), 750)
})

test('sayı girişi temizleme ve RiR metni', () => {
  assert.equal(cleanNumInput('60.5.2', true), '60.52'); assert.equal(cleanNumInput('62,5', true), '62,5'); assert.equal(cleanNumInput('1a0.', false), '10')
  assert.equal(cleanNumInput('1234567', true), '123456')
  assert.equal(rirText(2.5), '2,5'); assert.equal(rirText(1), '1'); assert.equal(rirText(5), '4+')
})

test('kardiyo: aşırı hız ACSM sınırına çekilir', () => {
  const absurd = cardioKcal({ type: 'run', minutes: 1, weightKg: 70, distanceKm: 300 })
  const fast = cardioKcal({ type: 'run', minutes: 60, weightKg: 70, distanceKm: 25 })
  assert.ok(absurd.met <= fast.met + 0.01)
})
