import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activationLevel, bestSide, cnsBucket, cropFor, smoothPath } from '../lib/anatomy.ts'

test('yumuşatılmış yol: kapalı, nokta sayısı kadar eğri, kısa çokgen boş', () => {
  const d = smoothPath([[0, 0], [10, 0], [10, 10], [0, 10]])
  assert.match(d, /^M0 0C/); assert.match(d, /Z$/); assert.equal((d.match(/C/g) ?? []).length, 4)
  assert.equal(smoothPath([[0, 0], [1, 1]]), '')
})

test('etki kademesi, MSS kademesi, yüz ve kırpma', () => {
  assert.deepEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(activationLevel), [6, 5, 5, 4, 4, 3, 3, 2, 2, 1])
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 10].map(cnsBucket), [1, 1, 2, 2, 3, 3, 4, 4])
  assert.equal(bestSide({ pectoralisSternal: 9, tricepsLateral: 6 }), 'front')
  assert.equal(bestSide({ lats: 9, biceps: 6 }), 'back')
  assert.equal(cropFor(['quads', 'glutes', 'abs']).y, 1150)
  assert.equal(cropFor(['pectoralisSternal', 'anteriorDeltoid']).y, 120)
})
