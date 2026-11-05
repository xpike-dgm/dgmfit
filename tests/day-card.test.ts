import { test } from 'node:test'
import assert from 'node:assert/strict'
import { microRows, toneFor, isCardKind } from '../lib/day-card.ts'

test('ton: hedef türünde %100 iyi; sınır türünde aşım kötü, %75–100 uyarı', () => {
  assert.equal(toneFor('min', 100), 'good'); assert.equal(toneFor('min', 99), 'warn')
  assert.equal(toneFor('max', 74), 'good'); assert.equal(toneFor('max', 96), 'warn'); assert.equal(toneFor('max', 121), 'bad')
})

test('mikro satırları: yalnızca değeri olanlar, öncelik sırası, sınır ve yüzde', () => {
  const r = microRows({ vitC: 96, fiber: 27, sodium: 2410, sugar: 0, mg: 310, unknown: 5 }, 10)
  assert.deepEqual(r.map((x) => x.key), ['fiber', 'sodium', 'mg', 'vitC'])
  assert.equal(r[0].pct, 108); assert.equal(r[0].tone, 'good')
  assert.equal(r[1].kind, 'max'); assert.equal(r[1].pct, 121); assert.equal(r[1].tone, 'bad')
  assert.equal(r[2].tone, 'warn')
  assert.equal(microRows({ fiber: 1, sugar: 1, sodium: 1, satFat: 1, ca: 1, fe: 1, k: 1 }, 6).length, 6)
  assert.equal(isCardKind('a'), true); assert.equal(isCardKind('c'), false)
})
