// P-6: dışarıda toplanan yemek verisini doğrular ve (istenirse) DgFit veri dosyalarına ekler.
// Kullanım:
//   node --experimental-strip-types scripts/food-import.mjs gelen.json            # yalnızca rapor (hiçbir şey yazılmaz)
//   node --experimental-strip-types scripts/food-import.mjs gelen.json --uygula   # hata yoksa ekler + foods-seed'i yeniden derler
// Biçim ve talimat: docs/yemek-verisi/. Sonrasında normal yayın akışı (verify → release) besinleri canlıya taşır.
import fs from 'node:fs'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { validateImport } from '../lib/food-import.ts'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const apply = args.includes('--uygula')
if (!file) { console.error('Kullanım: food-import.mjs <dosya.json> [--uygula]'); process.exit(2) }

let input
try { input = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { console.error('Dosya okunamadı ya da geçerli JSON değil:', e.message); process.exit(1) }
const readJson = (p, key) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { [key]: [] })
const usda = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/usda-sr.json.gz')).toString()).foods
const foodsDoc = readJson('data/tr-foods.json', 'foods')
const dishesDoc = readJson('data/tr-dishes.json', 'dishes')
const productsDoc = fs.existsSync('data/tr-products.json') ? readJson('data/tr-products.json', 'products')
  : { $comment: 'Paketli ürünler (etiket değerleri, 100 g başına). scripts/food-import.mjs ile doğrulanarak eklenir; kaynak (src) alanı zorunlu.', products: [] }

const r = validateImport(input, { usda, foods: foodsDoc.foods, dishes: dishesDoc.dishes, products: productsDoc.products })
const errs = r.issues.filter((i) => i.level === 'hata'), warns = r.issues.filter((i) => i.level === 'uyarı')

console.log(`\nYEMEK VERİSİ İÇE AKTARMA — ${file}`)
console.log(`Eklenecek: ${r.add.foods.length} besin, ${r.add.dishes.length} yemek, ${r.add.products.length} ürün · atlanan (tekrar): ${r.skipped.length} · hata: ${errs.length} · uyarı: ${warns.length}\n`)
if (errs.length) { console.log('HATALAR (düzeltilmeden hiçbir şey eklenmez):'); for (const i of errs) console.log(`  ✗ ${i.where}: ${i.msg}`); console.log('') }
if (warns.length) { console.log('UYARILAR (eklenir, ama kontrol et):'); for (const i of warns) console.log(`  ! ${i.where}: ${i.msg}`); console.log('') }
if (r.skipped.length) { console.log('ATLANANLAR:'); for (const s of r.skipped) console.log(`  · ${s.where}: ${s.why}`); console.log('') }
if (r.preview.length) {
  console.log('HESAPLANAN DEĞERLER (100 g):')
  for (const p of r.preview) console.log(`  ${p.name.slice(0, 34).padEnd(34)} ${String(Math.round(p.kcal)).padStart(4)} kcal  P ${p.protein.toFixed(1).padStart(5)}  K ${p.carb.toFixed(1).padStart(5)}  Y ${p.fat.toFixed(1).padStart(5)}`)
  console.log('')
}

if (errs.length) { console.log('SONUÇ: HATA VAR — dosya düzeltilip yeniden denenmeli.'); process.exit(1) }
if (!apply) { console.log('SONUÇ: hazır. Eklemek için aynı komutu --uygula ile çalıştır.'); process.exit(0) }

const sortByK = (a, b) => a.k.localeCompare(b.k)
foodsDoc.foods.push(...r.add.foods)
dishesDoc.dishes.push(...r.add.dishes)
productsDoc.products.push(...r.add.products); productsDoc.products.sort(sortByK)
const write = (p, doc) => fs.writeFileSync(p, JSON.stringify(doc, null, 1) + '\n')
if (r.add.foods.length) write('data/tr-foods.json', foodsDoc)
if (r.add.dishes.length) write('data/tr-dishes.json', dishesDoc)
if (r.add.products.length || !fs.existsSync('data/tr-products.json')) write('data/tr-products.json', productsDoc)
console.log('Veri dosyalarına eklendi. foods-seed yeniden derleniyor…')
execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/data/build_foods.mjs'], { stdio: ['ignore', 'inherit', 'inherit'] })
console.log('SONUÇ: eklendi. Yayın için: ./scripts/verify.sh → ./scripts/release.sh')
