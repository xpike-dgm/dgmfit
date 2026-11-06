import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DAILY_CAP, pushAllowed } from '../lib/push-plan.ts'

test('bildirim planlayıcı: üst sınır, uyku saati, acil her zaman', () => {
  assert.equal(pushAllowed({ kind: 'normal', sentToday: 0, nowMin: 12 * 60 }).ok, true)
  assert.equal(pushAllowed({ kind: 'normal', sentToday: DAILY_CAP, nowMin: 12 * 60 }).ok, false)
  assert.equal(pushAllowed({ kind: 'normal', sentToday: 0, nowMin: 2 * 60, wake: '07:00', sleep: '23:00' }).ok, false)
  assert.equal(pushAllowed({ kind: 'normal', sentToday: 0, nowMin: 1 * 60, wake: '10:00', sleep: '02:00' }).ok, true, 'gece yarısından sonra uyuyan')
  assert.equal(pushAllowed({ kind: 'urgent', sentToday: 99, nowMin: 3 * 60 }).ok, true)
})
