import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consistency, dots, duelResult, nudgeAllowed, prSuspicious, progressOf, rankBoard, storyAlive } from '../lib/social-rank.ts'
import type { DayFacts } from '../lib/weekly.ts'

test('DOTS: kaynaktaki polinomla elle hesaplanan değer, sınırlar', () => {
  // erkek 100 kg, toplam 600: poly = −1,093e−6·1e8 + 7,391293e−4·1e6 − 0,1918759221·1e4 + 24,0900756·100 − 307,75076 = 812,3266…
  const poly = -0.000001093 * 1e8 + 0.0007391293 * 1e6 - 0.1918759221 * 1e4 + 24.0900756 * 100 - 307.75076
  assert.equal(dots(600, 100, 'male'), Math.round((600 * 500 / poly) * 100) / 100)
  assert.ok(dots(600, 100, 'male') > 360 && dots(600, 100, 'male') < 380)
  assert.equal(dots(300, 30, 'female'), dots(300, 40, 'female')) // 40 kg altı sınıra sabit
  assert.equal(dots(800, 250, 'male'), dots(800, 210, 'male'))
  assert.ok(dots(300, 60, 'female') > dots(300, 60, 'male')) // kadın katsayısı daha yüksek
  assert.equal(dots(0, 80, 'male'), 0)
})

test('tutarlılık: haftalık hedef, hafta başına en fazla %100', () => {
  assert.equal(consistency([3, 3, 3, 3], 3), 100)
  assert.equal(consistency([6, 0, 3, 3], 3), 75)
  assert.equal(consistency([1, 2], 4), 38)
  assert.equal(consistency([], 3), 0)
})

const day = (o: Partial<DayFacts>): DayFacts => ({ day: '2026-11-01', target: 2000, eaten: 0, items: 0, protein: 0, proteinTarget: 120, burned: 0, waterMl: 0, waterGoal: 2500, workouts: 0, cardioMin: 0, volumeKg: 0, ...o })
test('meydan okuma ilerlemesi gerçek gün özetlerinden', () => {
  const ds = [day({ waterMl: 2600, workouts: 1, volumeKg: 5000, protein: 130 }), day({ waterMl: 2400, cardioMin: 30 }), day({ waterMl: 3000, cardioMin: 10, protein: 119 })]
  assert.equal(progressOf('water_days', 2500, ds), 2)
  assert.equal(progressOf('training_days', null, ds), 2) // 10 dk kardiyo sayılmaz
  assert.equal(progressOf('volume', null, ds), 5000)
  assert.equal(progressOf('protein_days', null, ds), 1)
  assert.equal(progressOf('cardio_minutes', null, ds), 40)
})

test('sıralama, eşitlik ve düello', () => {
  const r = rankBoard([{ userId: 'a', name: 'Ali', value: 10 }, { userId: 'b', name: 'Banu', value: 16 }, { userId: 'c', name: 'Can', value: 10 }], 16)
  assert.deepEqual(r.map((x) => [x.userId, x.rank, x.pct, x.done]), [['b', 1, 100, true], ['a', 2, 63, false], ['c', 2, 63, false]])
  assert.deepEqual(duelResult({ userId: 'a', value: 3 }, { userId: 'b', value: 2 }, false), { leader: 'a', winner: null })
  assert.deepEqual(duelResult({ userId: 'a', value: 2 }, { userId: 'b', value: 2 }, true), { leader: null, winner: null })
})

test('şüpheli PR: haftalık %30 sıçrama ve olağandışı oran', () => {
  assert.match(prSuspicious({ type: 'e1rm', value: 140, best7dAgo: 100, exerciseKey: 'Barbell_Squat', bodyKg: 80, sex: 'male' })!, /%40/)
  assert.equal(prSuspicious({ type: 'e1rm', value: 125, best7dAgo: 100, exerciseKey: 'Barbell_Squat', bodyKg: 80, sex: 'male' }), null)
  assert.equal(prSuspicious({ type: 'kg', value: 270, best7dAgo: null, exerciseKey: 'Barbell_Squat', bodyKg: 80, sex: 'male' }), 'vücut ağırlığına göre olağandışı') // 3,4 > 2,5 × 1,3
  assert.equal(prSuspicious({ type: 'reps', value: 50, best7dAgo: 10, exerciseKey: 'Barbell_Squat', bodyKg: 80, sex: 'male' }), null)
  assert.equal(prSuspicious({ type: 'kg', value: 60, best7dAgo: null, exerciseKey: 'Dumbbell_Curl', bodyKg: 80, sex: 'male' }), null)
})

test('dürtme sınırı ve kart süresi', () => {
  assert.equal(nudgeAllowed([], 'b', 'water'), null)
  assert.match(nudgeAllowed([{ to: 'b', kind: 'water' }], 'b', 'water')!, /zaten/)
  assert.equal(nudgeAllowed([{ to: 'b', kind: 'water' }], 'b', 'workout'), null)
  assert.match(nudgeAllowed(Array.from({ length: 10 }, (_, i) => ({ to: 'x' + i, kind: 'water' })), 'b', 'workout')!, /hakkın/)
  const now = Date.now()
  assert.equal(storyAlive(now - 23 * 3600_000, now), true)
  assert.equal(storyAlive(now - 25 * 3600_000, now), false)
})
