import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atwaterKcal, computeRecipe, forGrams, normalizeSearch } from '../lib/nutrition.ts'

test('gramaja göre ölçekleme', () => {
  assert.deepEqual(forGrams({ kcal: 358, protein: 23.91 }, 50), { kcal: 179, protein: 11.955 })
})

test('tarif: pişince su kaybı 100 g değerini artırır', () => {
  const r = computeRecipe([{ per100: { kcal: 100, protein: 10, water: 80 }, grams: 200 }, { per100: { kcal: 0, protein: 0, water: 100 }, grams: 100 }], 250)
  assert.equal(r.rawGrams, 300)
  assert.equal(r.per100.kcal, 80) // 200 kcal / 250 g
  assert.equal(r.per100.protein, 8)
  assert.equal(r.per100.water, ((160 + 100 - 50) * 100) / 250) // 50 g su buharlaştı
  assert.deepEqual(r.missing, ['carb', 'fat', 'fiber', 'sugar', 'satFat', 'sodium', 'chol', 'ca', 'fe', 'k', 'vitC', 'vitD', 'vitA', 'mg', 'zn', 'b6', 'b12'])
})

test('tarif: verim verilmezse çiğ ağırlık', () => {
  const r = computeRecipe([{ per100: { kcal: 200 }, grams: 50 }, { per100: { kcal: 100 }, grams: 50 }])
  assert.equal(r.yieldGrams, 100); assert.equal(r.per100.kcal, 150)
})

test('Atwater ve arama normalizasyonu', () => {
  assert.equal(atwaterKcal({ protein: 10, carb: 20, fat: 5 }), 165)
  assert.equal(normalizeSearch('Tavuk Göğsü (Pişmiş)'), 'tavuk gogsu pismis')
  assert.equal(normalizeSearch('ÇİĞ KÖFTE'), 'cig kofte')
  assert.equal(normalizeSearch('Şeftali, %2'), 'seftali %2')
})
