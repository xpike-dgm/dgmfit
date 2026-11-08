import { test } from 'node:test'
import assert from 'node:assert/strict'

test('Y1: mantıksal gün — gün sınırına kadar dünün devamı', async () => {
  const { logicalDay, dayString, inLateWindow, clampDayStart, setDayOffsetProvider, DAY_START_DEFAULT } = await import('../lib/time.ts')
  const at = (iso: string) => new Date(iso) // Türkiye UTC+3
  // 8 Kasım 01.30 (TR) = 7 Kasım 22.30 UTC
  assert.equal(logicalDay(at('2026-11-07T22:30:00Z'), 0), '2026-11-08')
  assert.equal(logicalDay(at('2026-11-07T22:30:00Z'), 240), '2026-11-07')
  assert.equal(logicalDay(at('2026-11-07T22:30:00Z'), 60), '2026-11-08') // 01.30 > 01.00 sınırı
  // 8 Kasım 04.00 tam sınırda yeni gün
  assert.equal(logicalDay(at('2026-11-08T01:00:00Z'), 240), '2026-11-08')
  assert.equal(logicalDay(at('2026-11-08T00:59:00Z'), 240), '2026-11-07')
  assert.equal(inLateWindow(at('2026-11-07T22:30:00Z'), 240), true)
  assert.equal(inLateWindow(at('2026-11-08T09:00:00Z'), 240), false)
  assert.equal(clampDayStart('abc'), DAY_START_DEFAULT); assert.equal(clampDayStart(-5), 0); assert.equal(clampDayStart(5000), 1439)
  // sağlayıcı: dayString varsayılanı istek sınırını kullanır, açık sınır her zaman önce gelir
  setDayOffsetProvider(() => 240)
  assert.equal(dayString(at('2026-11-07T22:30:00Z')), '2026-11-07')
  assert.equal(dayString(at('2026-11-07T22:30:00Z'), 0), '2026-11-08')
  setDayOffsetProvider(null)
  assert.equal(dayString(at('2026-11-07T22:30:00Z')), '2026-11-08')
})

test('Y1: saat eki', async () => {
  const { atTime } = await import('../lib/time.ts')
  assert.equal(atTime(240), "04.00'te"); assert.equal(atTime(120), "02.00'de"); assert.equal(atTime(360), "06.00'da")
  assert.equal(atTime(0), 'gece yarısında'); assert.equal(atTime(19 * 60 + 30), "19.30'da"); assert.equal(atTime(19 * 60 + 7), "19.07'de"); assert.equal(atTime(10 * 60), "10.00'da"); assert.equal(atTime(3 * 60 + 40), "03.40'ta")
})
