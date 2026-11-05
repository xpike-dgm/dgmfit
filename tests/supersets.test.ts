import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterSupersetSet, relinkSuperset, supersetBlocks, supersetMembers } from '../lib/supersets.ts'

const ex = (superset: number | null, done: boolean[]) => ({ superset, sets: done.map((d) => ({ done: d })) })

test('süperset blokları: ardışık aynı numara; tek üyeli grup çözülür', () => {
  const xs = [{ superset: null }, { superset: 1 }, { superset: 1 }, { superset: 2 }, { superset: 3 }, { superset: 3 }, { superset: 3 }]
  assert.deepEqual(supersetBlocks(xs), [{ group: null, idx: [0] }, { group: 1, idx: [1, 2] }, { group: null, idx: [3] }, { group: 3, idx: [4, 5, 6] }])
  assert.deepEqual(supersetMembers(xs, 5), [4, 5, 6]); assert.deepEqual(supersetMembers(xs, 3), [3])
})

test('süperset akışı: A1 → B1 (dinlenme yok) → dinlen, A2 → … → bitti', () => {
  // A seti 1 bitti → sırada B
  assert.deepEqual(afterSupersetSet([ex(1, [true, false]), ex(1, [false, false])], 0), { focus: 1, rest: false })
  // B seti 1 bitti → tur sonu: dinlen, A'ya dön
  assert.deepEqual(afterSupersetSet([ex(1, [true, false]), ex(1, [true, false])], 1), { focus: 0, rest: true })
  // son tur bitti → dinlenme, odak yok (sonraki harekete normal geçiş)
  assert.deepEqual(afterSupersetSet([ex(1, [true, true]), ex(1, [true, true])], 1), { focus: null, rest: true })
  // B'nin seti daha az: A3 bitince B'de set kalmadı → tur sonu, A'ya dön
  assert.deepEqual(afterSupersetSet([ex(1, [true, true, false, false]), ex(1, [true, true])], 0), { focus: 0, rest: true })
  // üçlü grup, ortadaki bitti → üçüncüye
  assert.deepEqual(afterSupersetSet([ex(2, [true]), ex(2, [true]), ex(2, [false])], 1), { focus: 2, rest: false })
  // süperset değil → eski davranış
  assert.deepEqual(afterSupersetSet([ex(null, [true, false])], 0), { focus: null, rest: true })
})

test('sonrakiyle süperset bağla / boz', () => {
  assert.deepEqual(relinkSuperset([null, null, null], 0, true), [1, 1, null])
  assert.deepEqual(relinkSuperset([1, 1, null], 1, true), [1, 1, 1])
  assert.deepEqual(relinkSuperset([1, 1, 1], 0, false), [null, 2, 2])
  assert.deepEqual(relinkSuperset([1, 1, null], 0, false), [null, null, null])
  assert.deepEqual(relinkSuperset([null, 2, 2], 0, true), [2, 2, 2])
  assert.deepEqual(relinkSuperset([1, 1], 1, true), [1, 1]) // son hareket: değişmez
})
