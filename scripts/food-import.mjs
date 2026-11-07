// P-6: dışarıda toplanan yemek verisini doğrular ve (istenirse) DgFit veri dosyalarına ekler.
// Kullanım:
//   node --experimental-strip-types scripts/food-import.mjs gelen.json            # yalnızca rapor (hiçbir şey yazılmaz)
//   node --experimental-strip-types scripts/food-import.mjs gelen.json --uygula   # hata yoksa ekler + foods-seed'i yeniden derler
//   node --experimental-strip-types scripts/food-import.mjs veri.csv --uygula --hatalilari-atla
//       # CSV de olur (başlıklar: docs/yemek-verisi/TALIMAT.md); --hatalilari-atla: bozuk satırları rapora ayırıp geri kalanı ekler
// Tam rapor her zaman <dosya>.rapor.txt olarak yazılır; ekranda özet ve ilk satırlar görünür.
// Biçim ve talimat: docs/yemek-verisi/. Sonrasında normal yayın akışı (verify → release) besinleri canlıya taşır.
import fs from 'node:fs'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { csvToImport, validateImport } from '../lib/food-import.ts'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const apply = args.includes('--uygula')
const skipBad = args.includes('--hatalilari-atla')
if (!file) { console.error('Kullanım: food-import.mjs <dosya.json> [--uygula]'); process.exit(2) }

let input
try {
  const text = fs.readFileSync(file, 'utf8')
  input = /\.(csv|tsv|txt)$/i.test(file) ? csvToImport(text, `CSV: ${file.split('/').pop()}`) : JSON.parse(text)
} catch (e) { console.error('Dosya okunamadı ya da geçerli JSON/CSV değil:', e.message); process.exit(1) }
const readJson = (p, key) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { [key]: [] })
const usda = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/usda-sr.json.gz')).toString()).foods
const foodsDoc = readJson('data/tr-foods.json', 'foods')
const dishesDoc = readJson('data/tr-dishes.json', 'dishes')
const productsDoc = fs.existsSync('data/tr-products.json') ? readJson('data/tr-products.json', 'products')
  : { $comment: 'Paketli ürünler (etiket değerleri, 100 g başına). scripts/food-import.mjs ile eklenir; kaynak (src) isteğe bağlı.', products: [] }

const r = validateImport(input, { usda, foods: foodsDoc.foods, dishes: dishesDoc.dishes, products: productsDoc.products })
const errs = r.issues.filter((i) => i.level === 'hata'), warns = r.issues.filter((i) => i.level === 'uyarı')

const lines = []
const out = (l = '') => lines.push(l)
out(`YEMEK VERİSİ İÇE AKTARMA — ${file}`)
out(`Eklenecek: ${r.add.foods.length} besin, ${r.add.dishes.length} yemek, ${r.add.products.length} ürün · atlanan (zaten var): ${r.skipped.length} · hatalı satır: ${errs.length} · uyarı: ${warns.length}`)
out('')
if (errs.length) { out(skipBad ? 'HATALI SATIRLAR (eklenmez; geri kalanı eklenir):' : 'HATALAR (düzeltilmeden hiçbir şey eklenmez; ya da --hatalilari-atla):'); for (const i of errs) out(`  ✗ ${i.where}: ${i.msg}`); out('') }
if (warns.length) { out('UYARILAR (eklenir, ama kontrol et):'); for (const i of warns) out(`  ! ${i.where}: ${i.msg}`); out('') }
if (r.skipped.length) { out('ATLANANLAR:'); for (const s of r.skipped) out(`  · ${s.where}: ${s.why}`); out('') }
if (r.preview.length) {
  out('DEĞERLER (100 g):')
  for (const p of r.preview) out(`  ${p.name.slice(0, 34).padEnd(34)} ${String(Math.round(p.kcal)).padStart(4)} kcal  P ${p.protein.toFixed(1).padStart(5)}  K ${p.carb.toFixed(1).padStart(5)}  Y ${p.fat.toFixed(1).padStart(5)}`)
  out('')
}
const reportFile = file.replace(/\.[^.]+$/, '') + '.rapor.txt'
fs.writeFileSync(reportFile, lines.join('\n') + '\n')
// ekranda: özet + her bölümün ilk 25 satırı
const MAX = 25
let shown = 0
for (const l of lines) {
  if (!l.startsWith('  ')) { shown = 0; console.log(l); continue }
  if (shown < MAX) console.log(l); else if (shown === MAX) console.log(`  … (devamı ${reportFile})`)
  shown++
}
console.log(`Tam rapor: ${reportFile}`)

if (errs.length && !skipBad) { console.log('SONUÇ: HATA VAR — dosya düzeltilip yeniden denenmeli ya da bozuk satırları ayırmak için --hatalilari-atla.'); process.exit(1) }
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
