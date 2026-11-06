import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recoveryState, recoveryText } from '../lib/recovery.ts'
import { suggestNext } from '../lib/training.ts'

test('toparlanma durumu: normal, hafif gün, deload', () => {
  assert.equal(recoveryState({ cnsLevel: 2, consecutiveDays: 1, lowFuelDays: 0, painRecent: false }).level, 'ok')
  assert.equal(recoveryState({ cnsLevel: 4, consecutiveDays: 1, lowFuelDays: 0, painRecent: false }).level, 'easy')
  assert.equal(recoveryState({ cnsLevel: 2, consecutiveDays: 5, lowFuelDays: 0, painRecent: false }).level, 'easy')
  assert.equal(recoveryState({ cnsLevel: 5, consecutiveDays: 3, lowFuelDays: 0, painRecent: false }).level, 'deload')
  assert.equal(recoveryState({ cnsLevel: 4, consecutiveDays: 0, lowFuelDays: 3, painRecent: false }).level, 'deload')
  assert.equal(recoveryText({ level: 'ok', reasons: [] }), null)
  assert.match(recoveryText(recoveryState({ cnsLevel: 5, consecutiveDays: 3, lowFuelDays: 0, painRecent: false }))!, /%10/)
})

test('öneri motoru toparlanmayı dikkate alır: hafif günde artış yok, deload günde %10 hafif', () => {
  const s = (kg: number, reps: number) => ({ kg, reps, rir: 1, type: 'normal' as const })
  const history = [{ day: '2026-11-01', sets: [s(100, 10), s(100, 10), s(100, 10)] }]
  const target = { repMin: 8, repMax: 10, rir: 1 }
  const normal = suggestNext({ history, target, kind: 'weight_reps' })!
  assert.ok(normal.kg > 100, 'normalde artış')
  const easy = suggestNext({ history, target, kind: 'weight_reps', recovery: 'easy' })!
  assert.equal(easy.kg, 100); assert.equal(easy.rule, 'cautious')
  const de = suggestNext({ history, target, kind: 'weight_reps', recovery: 'deload' })!
  assert.ok(de.kg <= 90.5 && de.kg >= 87.5, String(de.kg)); assert.equal(de.rule, 'deload')
})
