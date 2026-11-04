import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetImpact, isValidBarcode, macrosFor, mapOffProduct, mealForTime, portionGrams, sumMacros } from '../lib/food.ts'

test('öğün önerisi saate göre', () => {
  assert.equal(mealForTime(8 * 60), 'breakfast')
  assert.equal(mealForTime(13 * 60), 'lunch')
  assert.equal(mealForTime(16 * 60), 'snack')
  assert.equal(mealForTime(19 * 60 + 30), 'dinner')
  assert.equal(mealForTime(23 * 60), 'snack')
})

test('makro hesapları', () => {
  const m = macrosFor({ kcal: 58, protein: 2.69, carb: 8.12, fat: 1.87 }, 250)
  assert.deepEqual(m, { kcal: 145, protein: 6.7, carb: 20.3, fat: 4.7 })
  assert.deepEqual(sumMacros([m, m]), { kcal: 290, protein: 13.4, carb: 40.6, fat: 9.4 })
  assert.equal(portionGrams({ g: 25 }, 2), 50)
  assert.equal(portionGrams({ g: 206 }, 0.5), 103)
  assert.throws(() => portionGrams({ g: 25 }, 0))
})

test('bütçe etkisi', () => {
  assert.deepEqual(budgetImpact(420, 1000), { pct: 42, over: false })
  assert.deepEqual(budgetImpact(600, 500), { pct: 120, over: true })
  assert.deepEqual(budgetImpact(100, 0), { pct: null, over: true })
})

test('barkod doğrulama (EAN-13 / EAN-8)', () => {
  assert.equal(isValidBarcode('4006381333931'), true)
  assert.equal(isValidBarcode('4006381333932'), false)
  assert.equal(isValidBarcode('96385074'), true)
  assert.equal(isValidBarcode('abc'), false)
})

test('Open Food Facts eşleme', () => {
  const p = {
    product_name: 'Süzme Yoğurt', brands: 'Örnek Süt, Başka', quantity: '500 g', serving_size: '150 g', serving_quantity: 150,
    image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
    nutriments: { 'energy-kcal_100g': 98, proteins_100g: 9.2, carbohydrates_100g: 3.8, fat_100g: 5, sugars_100g: '3.8', sodium_100g: 0.04 },
  }
  const m = mapOffProduct('8690000000001', p)!
  assert.equal(m.nameTr, 'Süzme Yoğurt'); assert.equal(m.brand, 'Örnek Süt')
  assert.deepEqual(m.per100, { kcal: 98, protein: 9.2, carb: 3.8, fat: 5, sugar: 3.8, sodium: 40 })
  assert.deepEqual(m.portions.map((x) => x.g), [150, 500, 100])
  assert.equal(m.search, 'suzme yogurt ornek sut')
  // yalnızca kJ
  assert.equal(mapOffProduct('1', { product_name: 'x', nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } })!.per100.kcal, 100)
  // makro eksik → null
  assert.equal(mapOffProduct('1', { product_name: 'x', nutriments: { 'energy-kcal_100g': 100 } }), null)
  assert.equal(mapOffProduct('1', null), null)
})
