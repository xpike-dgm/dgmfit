// data/usda-sr.json.gz + data/tr-foods.json + data/tr-dishes.json → data/foods-seed.json.gz
// Kullanım: node --experimental-strip-types scripts/data/build_foods.mjs
import fs from 'node:fs'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { computeRecipe, atwaterKcal, normalizeSearch, NUTRIENT_KEYS } from '../../lib/nutrition.ts'

const usda = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/usda-sr.json.gz')).toString())
const tr = JSON.parse(fs.readFileSync('data/tr-foods.json', 'utf8')).foods
const dishes = JSON.parse(fs.readFileSync('data/tr-dishes.json', 'utf8')).dishes
// P-6: içe aktarılan paketli ürünler (etiket değerleri; scripts/food-import.mjs ile doğrulanmış)
const products = fs.existsSync('data/tr-products.json') ? JSON.parse(fs.readFileSync('data/tr-products.json', 'utf8')).products : []
const byDesc = new Map(usda.foods.map((f) => [f.en, f]))
const errors = []

const CAT = { 'Dairy and Egg Products': 'Süt ürünleri ve yumurta', 'Spices and Herbs': 'Baharat', 'Baby Foods': 'Bebek gıdaları', 'Fats and Oils': 'Yağlar', 'Poultry Products': 'Kümes hayvanları', 'Soups, Sauces, and Gravies': 'Çorba ve soslar', 'Sausages and Luncheon Meats': 'Şarküteri', 'Breakfast Cereals': 'Kahvaltılık gevrekler', 'Fruits and Fruit Juices': 'Meyveler', 'Pork Products': 'Domuz ürünleri', 'Vegetables and Vegetable Products': 'Sebzeler', 'Nut and Seed Products': 'Kuruyemiş', 'Beef Products': 'Sığır eti', 'Beverages': 'İçecekler', 'Finfish and Shellfish Products': 'Balık ve deniz ürünleri', 'Legumes and Legume Products': 'Bakliyat', 'Lamb, Veal, and Game Products': 'Kuzu ve dana', 'Baked Products': 'Fırın ürünleri', 'Sweets': 'Tatlılar', 'Cereal Grains and Pasta': 'Tahıllar', 'Fast Foods': 'Fast food', 'Meals, Entrees, and Side Dishes': 'Hazır yemekler', 'Snacks': 'Atıştırmalık', 'American Indian/Alaska Native Foods': 'Yerel gıdalar', 'Restaurant Foods': 'Restoran yemekleri' }
const UNIT = [[/\bcup\b/, 'su bardağı (cup)'], [/\btbsp\b|\btablespoon\b/, 'yemek kaşığı'], [/\btsp\b|\bteaspoon\b/, 'tatlı kaşığı'], [/\boz\b/, 'ons'], [/\bslice\b/, 'dilim'], [/\blarge\b/, 'büyük'], [/\bmedium\b/, 'orta'], [/\bsmall\b/, 'küçük'], [/\bserving\b/, 'porsiyon'], [/\bpiece\b/, 'parça'], [/\bfl oz\b/, 'sıvı ons']]
const trUnit = (s) => UNIT.reduce((a, [re, t]) => a.replace(re, t), s)

const rows = []
const curated = new Map()
const usedIds = new Set()
for (const t of tr) {
  const f = byDesc.get(t.usda)
  if (!f) { errors.push(`USDA açıklaması yok: ${t.k}`); continue }
  const portions = [{ label: '100 g', g: 100 }]
  for (const [label, g] of t.p) {
    if (typeof g === 'string') {
      const p = f.portions.find((x) => x.en.includes(g.slice(1)))
      if (!p) { errors.push(`USDA porsiyonu yok: ${t.k} ${g}`); continue }
      portions.unshift({ label, g: p.g })
    } else portions.unshift({ label, g })
  }
  // aynı USDA besinine bağlanan ikinci Türkçe ad (ör. şehriye = makarna) kendi kimliğini alır; ilk eşleme eski kimliğini korur
  const row = { source: 'usda', sourceId: usedIds.has(f.id) ? `${f.id}:${t.k}` : String(f.id), key: t.k, nameTr: t.tr, nameEn: f.en, category: t.c, n: f.n, portions: dedupe(portions), approx: !!t.approx, aliases: t.a ?? [] }
  curated.set(t.k, row); usedIds.add(f.id); rows.push(row)
}

for (const p of products) {
  const row = { source: 'dgfit-label', sourceId: p.k, key: p.k, nameTr: p.tr, nameEn: null, brand: p.brand, barcode: p.barcode, category: p.c, n: { ...p.n },
    portions: dedupe([...p.p.map(([label, g]) => ({ label, g })), { label: '100 g', g: 100 }]), approx: false, aliases: p.a ?? [], attribution: p.src ?? null }
  curated.set(p.k, row); rows.push(row) // tariflerde malzeme olarak da kullanılabilir
}

for (const d of dishes) {
  const ings = []
  for (const [k, g] of Object.entries(d.i)) {
    const c = curated.get(k)
    if (!c) { errors.push(`tarif ${d.k}: malzeme anahtarı yok: ${k}`); continue }
    ings.push({ per100: c.n, grams: g, key: k, name: c.nameTr })
  }
  if (ings.length !== Object.keys(d.i).length) continue
  const r = computeRecipe(ings, d.yield)
  if (d.yield > r.rawGrams * 1.3 || d.yield < r.rawGrams * 0.4) errors.push(`tarif ${d.k}: verim ${d.yield} g çiğ toplam ${r.rawGrams} g ile tutarsız`)
  const at = atwaterKcal(r.per100)
  if (r.per100.kcal > 20 && Math.abs(at - r.per100.kcal) / r.per100.kcal > 0.15) errors.push(`tarif ${d.k}: kcal ${r.per100.kcal} ile Atwater ${at.toFixed(0)} %15'ten fazla farklı`)
  rows.push({
    source: 'dgfit', sourceId: d.k, key: d.k, nameTr: d.tr, nameEn: null, category: d.c, n: r.per100,
    portions: dedupe([...d.p.map(([label, g]) => ({ label, g })), { label: '100 g', g: 100 }]), approx: true, aliases: d.a ?? [],
    recipe: { yield: d.yield, raw: r.rawGrams, ingredients: ings.map((i) => ({ key: i.key, name: i.name, g: i.grams })) },
  })
}

for (const f of usda.foods) {
  if (usedIds.has(f.id)) continue
  rows.push({ source: 'usda', sourceId: String(f.id), key: null, nameTr: null, nameEn: f.en, category: CAT[f.cat] ?? f.cat, n: f.n,
    portions: dedupe([...f.portions.slice(0, 4).map((p) => ({ label: trUnit(p.en), g: p.g })), { label: '100 g', g: 100 }]), approx: false, aliases: [] })
}

for (const r of rows) {
  r.search = normalizeSearch([r.nameTr, r.brand, ...(r.aliases ?? []), r.nameEn].filter(Boolean).join(' '))
  for (const k of Object.keys(r.n)) if (!NUTRIENT_KEYS.includes(k)) delete r.n[k]
}

function dedupe(ps) { const s = new Set(); return ps.filter((p) => (s.has(p.label) ? false : (s.add(p.label), true))) }

if (errors.length) { console.error('DERLEME HATALARI:\n  ' + errors.join('\n  ')); process.exit(1) }
const body = JSON.stringify(rows)
const version = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12)
fs.writeFileSync('data/foods-seed.json.gz', zlib.gzipSync(JSON.stringify({ version, generatedFrom: usda.source, count: rows.length, rows })))
console.log(`foods-seed: ${rows.length} satır (küratörlü ${curated.size - products.length}, ürün ${products.length}, yemek ${dishes.length}), sürüm ${version}`)
for (const d of rows.filter((r) => r.source === 'dgfit').slice(0, 40)) console.log(`  ${d.nameTr.padEnd(30)} ${String(d.n.kcal).padStart(4)} kcal  P ${d.n.protein}  K ${d.n.carb}  Y ${d.n.fat}  /100 g`)
