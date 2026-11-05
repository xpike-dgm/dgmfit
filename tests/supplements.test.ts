import { test } from 'node:test'
import assert from 'node:assert/strict'
import { servingLabel, limitWarnings, perServing, suppError, suppToFood, sumExtras, type SuppInput } from '../lib/supplements.ts'

const whey: SuppInput = { name: 'Whey', brand: null, unit: 'ölçek', servingG: 30, kcal: 120, protein: 24, carb: 3, fat: 1.5, extras: [{ name: 'BCAA', amount: 5.5, unit: 'g' }], daily: null }

test('porsiyon başına değer → 100 g başına ve geri (ölçek 30 g)', () => {
  const f = suppToFood(whey)
  assert.equal(f.per100.kcal, 400); assert.equal(f.per100.protein, 80)
  assert.deepEqual(f.portions, [{ label: '1 ölçek', g: 30 }])
  assert.deepEqual(perServing(f.per100, f.servingGrams), { kcal: 120, protein: 24, carb: 3, fat: 1.5 })
})

test('gramı bilinmeyen kapsül: 1 porsiyon = 1 sanal gram, değerler korunur', () => {
  const f = suppToFood({ ...whey, unit: 'kapsül', servingG: null, kcal: 9, protein: 0, carb: 0, fat: 1, extras: [] })
  assert.equal(f.servingGrams, 1); assert.equal(f.portions[0].label, '1 kapsül')
  assert.deepEqual(perServing(f.per100, 1), { kcal: 9, protein: 0, carb: 0, fat: 1 })
  assert.equal(perServing(f.per100, 2).kcal, 18) // 2 kapsül
})

test('ek içerik toplamı porsiyon sayısıyla çarpılır, aynı ad+birim birleşir', () => {
  const t = sumExtras([{ extras: [{ name: 'Kafein', amount: 200, unit: 'mg' }], count: 2 }, { extras: [{ name: 'kafein ', amount: 80, unit: 'mg' }], count: 1 }, { extras: [{ name: 'Kreatin', amount: 5, unit: 'g' }], count: 0 }])
  assert.deepEqual(t, [{ name: 'Kafein', amount: 480, unit: 'mg' }])
  assert.equal(limitWarnings(t).length, 1)
  assert.equal(limitWarnings([{ name: 'Kafein', amount: 300, unit: 'mg' }]).length, 0)
  assert.equal(limitWarnings([{ name: 'D3 vitamini', amount: 5000, unit: 'IU' }]).length, 1)
})

test('doğrulama: ad, birim, makro-kalori tutarlılığı, ek içerik, günlük hedef', () => {
  assert.equal(suppError(whey), null)
  assert.match(suppError({ ...whey, name: ' ' })!, /adını/)
  assert.match(suppError({ ...whey, kcal: 20 })!, /uyuşmuyor/)
  assert.match(suppError({ ...whey, extras: [{ name: 'X', amount: 1, unit: 'mg' }] })!, /Ek içerik/)
  assert.match(suppError({ ...whey, daily: 0 })!, /Günlük hedef/)
  assert.equal(suppError({ ...whey, servingG: null, unit: 'tablet', kcal: 0, protein: 0, carb: 0, fat: 0, extras: [{ name: 'Magnezyum', amount: 200, unit: 'mg' }], daily: 1 }), null)
})

test('g/ml biriminde porsiyon miktarı zorunlu ve etikette yazar', () => {
  const k: SuppInput = { ...whey, name: 'Kreatin', unit: 'g', servingG: null, kcal: 0, protein: 0, carb: 0, fat: 0, extras: [] }
  assert.match(suppError(k)!, /kaç g/)
  assert.equal(suppError({ ...k, servingG: 5 }), null)
  assert.equal(suppToFood({ ...k, servingG: 5 }).portions[0].label, '5 g')
  assert.equal(servingLabel('kapsül', null), '1 kapsül'); assert.equal(servingLabel('ml', 2.5), '2,5 ml')
})
