import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alternatives, detectPlateau, isDeloadWeek, periodTarget, recovery, setBandStatus, setsByMuscle, strengthLevel, weekIndex, liftOf, type ExLite } from '../lib/progress.ts'
import { gzAdvance, gzSets } from '../lib/schemes.ts'

const D = (n: number) => new Date(Date.parse('2026-10-01T12:00:00Z') + n * 86400000).toISOString().slice(0, 10)

test('plato: 21+ gün, son 3 haftada önceki en iyi geçilemedi', () => {
  const s = [{ day: D(0), e1rm: 100 }, { day: D(7), e1rm: 104 }, { day: D(14), e1rm: 103 }, { day: D(21), e1rm: 103 }, { day: D(28), e1rm: 104.3 }, { day: D(35), e1rm: 102 }]
  const p = detectPlateau(s, D(36), { repMin: 8, repMax: 12 })
  assert.equal(p.plateau, true); assert.equal(p.weeks, 4); assert.equal(p.best, 104)
  assert.match(p.suggestions[1], /8–12 yerine 5–8/)
  // ilerleme var
  assert.equal(detectPlateau([...s.slice(0, 4), { day: D(30), e1rm: 106 }, { day: D(35), e1rm: 107 }], D(36)).plateau, false)
  // yetersiz veri
  assert.equal(detectPlateau(s.slice(0, 2), D(10)).plateau, false)
})

const ex = (id: number, p: Partial<ExLite>): ExLite => ({ id, nameTr: 'x' + id, primary: ['chest'], secondary: ['triceps'], equipment: 'barbell', kind: 'weight_reps', pattern: 'push', mechanic: 'compound', curated: false, category: 'strength', ...p })
test('alternatif: aynı birincil kas + tip, farklı ekipman ve küratörlü önce; mevcut ekipman filtresi', () => {
  const t = ex(1, {})
  const pool = [t, ex(2, { equipment: 'dumbbell', curated: true }), ex(3, { equipment: 'barbell' }), ex(4, { primary: ['lats'], pattern: 'pull' }), ex(5, { equipment: 'machine' }), ex(6, { category: 'stretching', equipment: 'body only' })]
  assert.deepEqual(alternatives(t, pool).map((x) => x.id), [2, 5, 3])
  assert.deepEqual(alternatives(t, pool, new Set(['machine'])).map((x) => x.id), [5])
})

test('kuvvet seviyesi (yaklaşık oran)', () => {
  assert.equal(liftOf('Barbell_Bench_Press_-_Medium_Grip'), 'bench')
  const b = strengthLevel('bench', 80, 80, 'male')!
  assert.deepEqual([b.level, b.ratio, b.next], ['Orta', 1, { level: 'İleri', kg: 120 }])
  assert.equal(strengthLevel('bench', 30, 80, 'male')!.level, 'Başlangıç altı')
  assert.equal(strengthLevel('deadlift', 250, 80, 'male')!.next, null) // elit
  assert.equal(strengthLevel('curl', 50, 80, 'male'), null)
})

test('kas başına set ve 10–20 bandı', () => {
  const m = setsByMuscle([{ primary: ['chest'], secondary: ['triceps', 'shoulders'] }, { primary: ['chest'], secondary: [] }, { primary: ['triceps'], secondary: [] }])
  assert.deepEqual(m, { chest: 2, triceps: 1.5, shoulders: 0.5 })
  assert.deepEqual([setBandStatus(6), setBandStatus(12), setBandStatus(24)], ['az', 'iyi', 'çok'])
})

test('toparlanma', () => {
  assert.deepEqual([recovery(null, 0), recovery(10, 1), recovery(40, 6), recovery(40, 2), recovery(60, 9), recovery(80, 9)], ['yeşil', 'kırmızı', 'kırmızı', 'sarı', 'sarı', 'yeşil'])
})

test('periyodizasyon: deload, DUP, blok', () => {
  const base = { sets: 3, repMin: 8, repMax: 12, rir: 2 }
  assert.equal(weekIndex('2026-11-02', '2026-11-15'), 1)
  assert.deepEqual([0, 1, 2, 3, 4, 7].map((w) => isDeloadWeek(w, 4)), [false, false, false, true, false, true])
  const dl = periodTarget({ scheme: 'linear', week: 3, session: 0, base, deloadEvery: 4 })
  assert.deepEqual([dl.sets, dl.rir, dl.loadPct, dl.deload], [2, 4, 0.9, true])
  const dup = [0, 1, 2].map((s) => periodTarget({ scheme: 'dup', week: 0, session: s, base, deloadEvery: 0 }))
  assert.deepEqual(dup.map((t) => [t.repMin, t.repMax, t.rir, t.label]), [[5, 7, 1, 'Ağır gün'], [8, 12, 2, 'Orta gün'], [12, 16, 3, 'Hafif gün']])
  assert.equal(periodTarget({ scheme: 'block', week: 0, session: 0, base, deloadEvery: 0 }).sets, 4)
  assert.equal(periodTarget({ scheme: 'block', week: 4, session: 0, base, deloadEvery: 0 }).label, 'Yoğunlaşma bloğu')
  assert.equal(periodTarget({ scheme: 'linear', week: 2, session: 0, base, deloadEvery: 0 }).label, 'Lineer')
})

test('GZCLP T1: 5×3 → 6×2 → 10×1 → %85 sıfırlama; başarıda alt vücut +5', () => {
  let s = { tier: 't1' as const, stage: 0, kg: 100, lastBaseKg: null }
  assert.deepEqual(gzSets(s).map((x) => [x.reps, x.amrap]), [[3, false], [3, false], [3, false], [3, false], [3, true]])
  const fiveOk = Array(5).fill({ kg: 100, reps: 3 })
  let r = gzAdvance(s, fiveOk, true); assert.deepEqual([r.result, r.next.kg, r.next.stage], ['artış', 105, 0])
  r = gzAdvance(r.next, [...Array(4).fill({ kg: 105, reps: 3 }), { kg: 105, reps: 2 }], true); assert.deepEqual([r.result, r.next.kg, r.next.stage], ['kademe', 105, 1])
  assert.equal(gzSets(r.next).length, 6)
  r = gzAdvance(r.next, Array(6).fill({ kg: 105, reps: 1 }), true); assert.deepEqual([r.result, r.next.stage], ['kademe', 2])
  r = gzAdvance(r.next, Array(9).fill({ kg: 105, reps: 1 }), true); assert.deepEqual([r.result, r.next.kg, r.next.stage], ['sıfırlama', 90, 0]) // 105 × 0,85 = 89,25 → 90
})

test('GZCLP T2 ve T3', () => {
  let s = { tier: 't2' as const, stage: 0, kg: 60, lastBaseKg: null }
  let r = gzAdvance(s, Array(3).fill({ kg: 60, reps: 10 }), false); assert.deepEqual([r.next.kg, r.next.lastBaseKg], [62.5, 60])
  r = gzAdvance(r.next, Array(3).fill({ kg: 62.5, reps: 7 }), false); assert.equal(r.next.stage, 1)
  r = gzAdvance(r.next, Array(3).fill({ kg: 62.5, reps: 5 }), false); assert.equal(r.next.stage, 2)
  r = gzAdvance(r.next, Array(3).fill({ kg: 62.5, reps: 4 }), false); assert.deepEqual([r.result, r.next.kg, r.next.stage], ['sıfırlama', 62.5, 0]) // son başarılı 60 + 2,5
  const t3 = { tier: 't3' as const, stage: 0, kg: 20, lastBaseKg: null }
  assert.equal(gzAdvance(t3, [{ kg: 20, reps: 15 }, { kg: 20, reps: 15 }, { kg: 20, reps: 22 }], false).result, 'aynı')
  assert.deepEqual(((x) => [x.result, x.next.kg])(gzAdvance(t3, [{ kg: 20, reps: 15 }, { kg: 20, reps: 15 }, { kg: 20, reps: 26 }], false)), ['artış', 22.5])
})
