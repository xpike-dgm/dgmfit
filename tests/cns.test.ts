import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cnsLevel, effortFactor, exerciseCns, sessionCns, setLoad, weeklyCns, type CnsSetIn } from '../lib/cns.ts'

test('hareket MSS puanı: lisanslı puan, yoksa tahmin', () => {
  assert.deepEqual(exerciseCns({ cns: 9, mechanic: null, equipment: 'barbell', kind: 'weight_reps' }), { score: 9, estimated: false })
  assert.deepEqual(exerciseCns({ cns: null, mechanic: 'compound', equipment: 'barbell', kind: 'weight_reps' }), { score: 7, estimated: true })
  assert.deepEqual(exerciseCns({ cns: null, mechanic: 'compound', equipment: 'dumbbell', kind: 'weight_reps' }), { score: 5, estimated: true })
  assert.deepEqual(exerciseCns({ cns: null, mechanic: 'isolation', equipment: 'cable', kind: 'weight_reps' }), { score: 3, estimated: true })
  assert.deepEqual(exerciseCns({ cns: null, mechanic: null, equipment: 'body only', kind: 'time' }), { score: 2, estimated: true })
  assert.equal(exerciseCns({ cns: 14, mechanic: null, equipment: '', kind: '' }).score, 10)
})

test('efor çarpanı ve set yükü', () => {
  assert.equal(effortFactor('normal', 0), 1.2); assert.equal(effortFactor('normal', 2), 1); assert.equal(effortFactor('normal', 4), 0.8)
  assert.equal(effortFactor('failure', 3), 1.2); assert.equal(effortFactor('drop', 3), 1.15); assert.equal(effortFactor('normal', null), 1)
  assert.equal(setLoad(8, 'warmup', 0), 0); assert.equal(setLoad(5, 'normal', 2), 0.5)
})

test('kademe sınırları', () => {
  assert.deepEqual([0, 2.9, 3, 6.9, 7, 11.9, 12, 16.9, 17, 40].map(cnsLevel), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
})

test('seans yükü: ısınma sayılmaz, katkı payları, tahmin bayrağı', () => {
  const set = (exerciseId: number, name: string, cns: number | null, rir: number | null, type = 'normal'): CnsSetIn => ({ exerciseId, name, cns, rir, type, mechanic: 'compound', equipment: 'barbell', kind: 'weight_reps' })
  const s = sessionCns([
    set(1, 'Squat', 9, 2, 'warmup'), set(1, 'Squat', 9, 2), set(1, 'Squat', 9, 2), set(1, 'Squat', 9, 1),
    set(2, 'Row', null, 2), set(2, 'Row', null, 2),
  ])
  // 0,9 + 0,9 + 0,99 + 0,7 + 0,7 = 4,19
  assert.equal(s.load, 4.2); assert.equal(s.level, 2); assert.equal(s.label, 'Hafif'); assert.equal(s.estimated, true)
  assert.equal(s.exercises[0].name, 'Squat'); assert.equal(s.exercises[0].sets, 3); assert.equal(s.exercises[0].share, 67)
  // ağır seans: 30 set × 9 puan × RiR 1 → 29,7 → 5
  assert.equal(sessionCns(Array.from({ length: 30 }, () => set(1, 'Deadlift', 9, 1))).level, 5)
  assert.equal(sessionCns([]).level, 1)
})

test('haftalık özet', () => {
  assert.deepEqual(weeklyCns([]), { total: 0, avgLevel: 0, hard: 0, note: 'Bu hafta kayıtlı antrenman yok.' })
  const w = weeklyCns([{ load: 18 }, { load: 13 }, { load: 8 }])
  assert.equal(w.total, 39); assert.equal(w.avgLevel, 4); assert.equal(w.hard, 2); assert.match(w.note, /2 yüksek yüklü seans/)
  assert.match(weeklyCns([{ load: 1 }, { load: 2 }]).note, /hafif/)
  assert.equal(weeklyCns([{ load: 9 }, { load: 10 }]).note, 'Haftalık yük dengeli görünüyor.')
})
