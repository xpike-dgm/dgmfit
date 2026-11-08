import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetImpact, isValidBarcode, macrosFor, mapOffProduct, per100Problem, mealForTime, portionGrams, sumMacros } from '../lib/food.ts'

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

test('per100Problem: fiziksel olarak imkânsız etiketleri yakalar', () => {
  assert.equal(per100Problem({ kcal: 52, protein: 0.3, carb: 14, fat: 0.2 }), null, 'elma')
  assert.equal(per100Problem({ kcal: 884, protein: 0, carb: 0, fat: 100 }), null, 'zeytinyağı')
  assert.equal(per100Problem({ kcal: 231, protein: 0, carb: 0, fat: 0 }), null, 'votka (alkol, makro yok)')
  assert.equal(per100Problem({ kcal: 43, protein: 0.5, carb: 3.6, fat: 0 }), null, 'bira')
  assert.ok(per100Problem({ kcal: 0, protein: 20, carb: 50, fat: 10 }), '0 kcal ama makro dolu')
  assert.ok(per100Problem({ kcal: 3000, protein: 10, carb: 10, fat: 10 }), '900 üstü')
  assert.ok(per100Problem({ kcal: 400, protein: -5, carb: 50, fat: 10 }), 'negatif')
  assert.ok(per100Problem({ kcal: 800, protein: 10, carb: 200, fat: 0 }), 'makro toplamı 100 g üstü')
  // gerçek etiket (kilo alma tozu, 100 g): yuvarlama yüzünden toplam 100,6 g — kabul edilmeli
  assert.equal(per100Problem({ kcal: 404, protein: 19, carb: 81.2, fat: 0.4 }), null, 'gainer etiketi 100,6 g')
  assert.ok(per100Problem({ kcal: 430, protein: 30, carb: 76, fat: 0 }), 'toplam 106 g reddedilir')
})

test('G1: ml birimli kendi besini', async () => {
  const { foodUnit, userFoodPortions, isBasePortion } = await import('../lib/food.ts')
  const p = userFoodPortions('ml', 330, '1 kutu')
  assert.deepEqual(p, [{ label: '1 kutu', g: 330 }, { label: '100 ml', g: 100 }])
  assert.equal(foodUnit(p), 'ml')
  assert.equal(foodUnit(userFoodPortions('g', 40)), 'g')
  assert.equal(userFoodPortions('g', 40)[0].label, '1 porsiyon (40 g)')
  assert.ok(isBasePortion('100 ml') && isBasePortion('100 g') && !isBasePortion('1 kutu'))
})

test('G1: veritabanındaki içecekler tanınır, katılar değil', async () => {
  const { isDrink, drinkPortions, foodUnit } = await import('../lib/food.ts')
  for (const [n, c] of [['Ayran', 'İçecekler'], ['Fer Gazoz', 'İçecekler'], ['%3 Yağlı Süt', 'Süt ürünleri'], ['Vitaminli Süt', 'Markalı ürünler'], ['Organik Pastörize Yağlı Süt', null],
    ['Türk Kahvesi', null], ['Vanilya Aromalı Latte Sıcak', null], ['Iced Coconut Latte', null], ['Orange juice, canned, unsweetened', 'Meyveler'], ['Vegetable juice cocktail, low sodium, canned', 'Sebzeler'],
    ['Milk, nonfat, fluid, without added vitamin A', 'Süt ürünleri ve yumurta'], ['Coconut Milk', null], ['Şalgam Suyu', null], ['Portakal Suyu', null], ['Kefir', 'Süt ürünleri'], ['Kakaolu Süt', null], ['Çikolatalı Süt', null], ['Maden Suyu', null], ['Sıcak Çikolata', 'İçecekler'], ['Çikolatalı Soya Sütü', 'İçecekler'], ['Bademli Kahveli Laktozsuz Glutensiz İçecek', 'İçecekler'], ['Damla Sakızlı Soda', 'İçecekler'], ['Coco Tropico Beyaz Çikolatalı Süt', null]] as const)
    assert.equal(isDrink(n, c), true, n)
  for (const [n, c] of [['Süt Burger Kakaolu', null], ['Çilekli Süt Dilimi', null], ['Süt Mısır', null], ['Cocoa Latte Cake', null], ['Kahveli Dondurma', null], ['Ayran Aşı Çorbası', null],
    ['Peaches, canned, juice pack, solids and liquids', 'Meyveler'], ['Puddings, rice, dry mix, prepared with whole milk', null], ['Crackers, saltines (includes oyster, soda, soup)', null],
    ['Leavening agents, baking soda', null], ['Candies, ROLO Caramels in Milk Chocolate', null], ['Beverages, Cocoa mix, no sugar added, powder', 'İçecekler'], ['Kahve Kremalı Pasta', 'İçecekler'],
    ['Su Paketi İçinde Şekersiz Meyve Kokteyli (Pişmiş veya Konservelenmiş)', null], ['Süzme Peyniri (Düşük Yağ, %1 Süt Yağı, Sodyumsuz)', null], ['Tavuklu Pilav', null], ['Lavi Sütlü Dolgulu Çikolata', null], ['Suyu Süzülmüş Meksika Fasulyesi', null], ['Mushroom Latte Mix', null], ['Sıcak Çikolatalı İçecek Tozu', 'İçecekler'], ['Kahve kreması (toz)', 'İçecekler'], ['Kahve Draje Bitter', 'İçecekler']] as const)
    assert.equal(isDrink(n, c), false, n)
  const p = drinkPortions([{ label: '1 bardak (200 g)', g: 200 }, { label: '100 g', g: 100 }])
  assert.deepEqual(p, [{ label: '1 bardak (200 ml)', g: 200 }, { label: '100 ml', g: 100 }])
  assert.equal(foodUnit(p), 'ml')
})
