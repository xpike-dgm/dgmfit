import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMeals, mealTarget, parseLimits, totalsOf, type MBFood } from '../lib/meal-builder.ts'

const F = (id: number, name: string, kcal: number, protein: number, carb: number, fat: number, minG = 50, maxG = 300, stepG = 10): MBFood => ({ id, name, per100: { kcal, protein, carb, fat }, minG, maxG, stepG })
const foods: MBFood[] = [
  F(1, 'Pirinç pilavı', 150, 3, 30, 2.5), F(2, 'Tavuk göğsü', 165, 31, 0, 3.6), F(3, 'Yoğurt', 61, 3.5, 4.7, 3.3),
  F(4, 'Muz', 89, 1.1, 23, 0.3, 100, 240, 20), F(5, 'Yumurta', 155, 13, 1.1, 11, 50, 150, 50), F(6, 'Bulgur pilavı', 140, 4, 26, 2.5),
  F(7, 'Ekmek', 265, 9, 49, 3.2, 25, 150, 25), F(8, 'Zeytinyağı', 884, 0, 0, 100, 5, 20, 5), F(9, 'Bal', 304, 0.3, 82, 0, 10, 40, 10),
  F(10, 'Yulaf', 389, 17, 66, 7, 30, 120, 10),
]

test('Y2: öğün kurucu — kullanıcının üst sınırlarına uyar (maks 20 g protein, 230 g karb, 30 g yağ)', () => {
  const meals = buildMeals({ remaining: { kcal: 1315, protein: 20, carb: 320, fat: 40 }, limits: { protein: 20, carb: 230, fat: 30 }, foods })
  assert.ok(meals.length >= 2, 'en az 2 öneri')
  for (const m of meals) {
    assert.ok(m.totals.protein <= 20 * 1.12, `protein ${m.totals.protein}`)
    assert.ok(m.totals.carb <= 230 * 1.05, `karb ${m.totals.carb}`)
    assert.ok(m.totals.fat <= 30 * 1.1, `yağ ${m.totals.fat}`)
    assert.ok(m.items.length >= 2 && m.items.length <= 3)
    assert.deepEqual(totalsOf(m.items.map((it) => ({ grams: it.grams, per100: foods.find((f) => f.id === it.id)!.per100 }))), m.totals)
  }
  // ilk öneri karbonhidrat hedefine anlamlı yaklaşır
  assert.ok(meals[0].totals.carb >= 120, `karb çok düşük: ${meals[0].totals.carb}`)
  // öneriler birbirinden farklı besinlerle başlar
  const ids = meals.map((m) => m.items.map((i) => i.id).sort().join(','))
  assert.equal(new Set(ids).size, ids.length)
})

test('Y2: öğün kurucu — sınır yoksa kalana yakın, bütçe dolmuşsa öneri yok', () => {
  const m = buildMeals({ remaining: { kcal: 600, protein: 45, carb: 60, fat: 18 }, foods })[0]
  assert.ok(Math.abs(m.totals.kcal - 600) <= 120, `kcal ${m.totals.kcal}`)
  assert.ok(m.totals.protein >= 30, `protein ${m.totals.protein}`)
  assert.deepEqual(buildMeals({ remaining: { kcal: -50, protein: 0, carb: 0, fat: 0 }, foods }), [])
  const { target, cap } = mealTarget({ kcal: 500, protein: 40, carb: 50, fat: 10 }, { fat: 30 })
  assert.equal(target.fat, 10); assert.equal(cap.fat, 30)
})

test('Y2: metinden sınırlar', () => {
  assert.deepEqual(parseLimits('Maksimum 20 protein maks 230 karbonhidrat maks 30 Gr yağ olcak'), { protein: 20, carb: 230, fat: 30 })
  assert.deepEqual(parseLimits('en fazla 500 kcal, protein 40 g'), { kcal: 500, protein: 40 })
  assert.deepEqual(parseLimits('akşama ne yesem'), {})
})

test('Y2: öğün payı — günün kalanı tek öğüne yığılmaz', async () => {
  const { mealShare } = await import('../lib/meal-builder.ts')
  assert.deepEqual(mealShare({ kcal: 2725, protein: 117, carb: 393, fat: 76 }, 2725), { kcal: 1000, protein: 43, carb: 144, fat: 28 })
  assert.deepEqual(mealShare({ kcal: 600, protein: 40, carb: 60, fat: 20 }, 2000), { kcal: 600, protein: 40, carb: 60, fat: 20 })
  assert.equal(mealShare({ kcal: 2000, protein: 100, carb: 200, fat: 60 }, 1500).kcal, 600)
  assert.equal(mealShare({ kcal: 2000, protein: 100, carb: 200, fat: 60 }, 3000, { kcal: 1500 }).kcal, 1500)
})
