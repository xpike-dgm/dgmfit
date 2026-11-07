import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareDays, nearest } from '../lib/progress-compare.ts'

test('nearest: ±7 gün içindeki en yakın kayıt', () => {
  const rows = [{ day: '2026-01-01' }, { day: '2026-01-10' }, { day: '2026-02-01' }]
  assert.equal(nearest(rows, '2026-01-08')!.day, '2026-01-10')
  assert.equal(nearest(rows, '2026-01-20'), null)
})

test('compareDays: kilo ve ölçü farkı, sıra önemsiz', () => {
  const m = [{ day: '2026-01-02', values: { waistCm: 90, armCm: 35, chestCm: null } }, { day: '2026-03-01', values: { waistCm: 85.5, armCm: 36.2, chestCm: 100 } }]
  const w = [{ day: '2026-01-01', kg: 84.2 }, { day: '2026-03-02', kg: 80.1 }]
  const r = compareDays('2026-03-01', '2026-01-01', m, w)
  assert.equal(r.days, 59)
  assert.equal(r.weight, -4.1)
  assert.deepEqual(r.deltas, [{ key: 'waistCm', delta: -4.5 }, { key: 'armCm', delta: 1.2 }])
})

test('compareDays: aynı kayda düşen uçlar fark üretmez', () => {
  const r = compareDays('2026-01-01', '2026-01-03', [{ day: '2026-01-02', values: { waistCm: 90 } }], [{ day: '2026-01-02', kg: 80 }])
  assert.equal(r.weight, null)
  assert.deepEqual(r.deltas, [])
})
