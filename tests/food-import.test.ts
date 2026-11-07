import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IMPORT_FORMAT, kcalRange, slug, validateImport, type ImportContext } from '../lib/food-import.ts'

const ctx = (): ImportContext => ({
  usda: [
    { id: 1, en: 'Kale, raw', n: { kcal: 35, protein: 2.9, carb: 4.4, fat: 1.5 } },
    { id: 2, en: 'Oil, olive, salad or cooking', n: { kcal: 884, protein: 0, carb: 0, fat: 100 } },
    { id: 3, en: 'Lentils, raw', n: { kcal: 352, protein: 24.6, carb: 63.4, fat: 1.1 } },
  ],
  foods: [{ k: 'zeytinyagi', tr: 'Zeytinyağı', c: 'Yağlar', usda: 'Oil, olive, salad or cooking', p: [] }],
  dishes: [],
  products: [{ k: 'var-olan', tr: 'Bisküvi', brand: 'X', barcode: '8690000000012', c: 'Atıştırmalık', n: { kcal: 450, protein: 8, carb: 64, fat: 17 }, p: [], src: 'etiket' }],
})

test('slug: Türkçe karakterler ve boşluklar', () => {
  assert.equal(slug('Kırmızı Mercimek Çorbası'), 'kirmizi-mercimek-corbasi')
  assert.equal(slug('  Şehriye (ince)  '), 'sehriye-ince')
})

test('kcalRange: kategoriye göre olağan aralık', () => {
  assert.deepEqual(kcalRange('Sebzeler'), [5, 180])
  assert.equal(kcalRange('Bilinmeyen tür'), null)
})

test('validateImport: biçim ve şablon denetimi', () => {
  assert.equal(validateImport({}, ctx()).issues[0].level, 'hata')
  assert.match(validateImport({ format: IMPORT_FORMAT, $sablon: 'x' }, ctx()).issues[0].msg, /şablon/)
})

test('validateImport: besin USDA id ya da açıklamayla; değer USDA dan; tekrar atlanır', () => {
  const r = validateImport({ format: IMPORT_FORMAT, besinler: [
    { ad: 'Kale', kategori: 'Sebzeler', usda: 1, porsiyonlar: [['1 avuç', 15]] },
    { ad: 'Mercimek', kategori: 'Bakliyat', usda: 'Lentils, raw' },
    { ad: 'zeytinyağı', kategori: 'Yağlar', usda: 2 }, // zaten var (ad aynı)
    { ad: 'Yok', kategori: 'Sebzeler', usda: 'Kale raw leaves' }, // birebir değil → öneriyle hata
  ] }, ctx())
  assert.deepEqual(r.add.foods.map((f) => f.k), ['kale', 'mercimek'])
  assert.equal(r.add.foods[0].usda, 'Kale, raw')
  assert.equal(r.skipped.length, 1)
  const e = r.issues.find((i) => i.level === 'hata')!
  assert.match(e.msg, /yakın olanlar: 1 · Kale, raw/)
})

test('validateImport: tarif değerleri malzemelerden hesaplanır; tutarsız verim hata', () => {
  const r = validateImport({ format: IMPORT_FORMAT, besinler: [{ ad: 'Kale', kategori: 'Sebzeler', usda: 1, anahtar: 'kale' }], yemekler: [
    { ad: 'Kale salatası', kategori: 'Salatalar', malzemeler: { kale: 100, zeytinyagi: 10 }, pismis_agirlik: 110 },
    { ad: 'Bozuk', kategori: 'Salatalar', malzemeler: { kale: 100 }, pismis_agirlik: 500 },
    { ad: 'Eksik', kategori: 'Salatalar', malzemeler: { olmayan: 50 }, pismis_agirlik: 50 },
  ] }, ctx())
  assert.equal(r.add.dishes.length, 1)
  const p = r.preview.find((x) => x.name === 'Kale salatası')!
  assert.ok(Math.abs(p.kcal - (35 + 88.4) / 1.1) < 1, `kcal ${p.kcal}`)
  assert.equal(r.issues.filter((i) => i.level === 'hata').length, 2)
})

test('validateImport: ürün etiketi denetimleri (Atwater, şeker, barkod, tekrar barkod, tuz→sodyum)', () => {
  const base = { ad: 'Kraker', marka: 'Y', kategori: 'Atıştırmalık', kaynak: 'etiket fotoğrafı' }
  const r = validateImport({ format: IMPORT_FORMAT, urunler: [
    { ...base, barkod: '8690000000029', '100g': { kcal: 450, protein: 9, karbonhidrat: 65, yag: 17, tuz_g: 1 } },
    { ...base, ad: 'Sıfır', '100g': { kcal: 0, protein: 20, karbonhidrat: 50, yag: 10 } },
    { ...base, ad: 'Şekerli', '100g': { kcal: 400, protein: 5, karbonhidrat: 50, yag: 20, seker: 60 } },
    { ...base, ad: 'Barkodsuz', barkod: '8690000000013', '100g': { kcal: 450, protein: 9, karbonhidrat: 65, yag: 17 } },
    { ...base, ad: 'Aynı barkod', barkod: '8690000000012', '100g': { kcal: 450, protein: 9, karbonhidrat: 65, yag: 17 } },
  ] }, ctx())
  assert.equal(r.add.products.length, 1)
  assert.equal(r.add.products[0].n.sodium, 400)
  assert.equal(r.issues.filter((i) => i.level === 'hata').length, 3)
  assert.equal(r.skipped.length, 1)
})

test('validateImport: kategoriye göre uç değer uyarısı (eklenir)', () => {
  const r = validateImport({ format: IMPORT_FORMAT, besinler: [{ ad: 'Mercimek kuru', kategori: 'Sebzeler', usda: 3 }] }, ctx())
  assert.equal(r.add.foods.length, 1)
  assert.equal(r.issues[0].level, 'uyarı')
})
