// P-6: dışarıda (başka bir yapay zekâyla) toplanan yemek verisinin içe aktarılması — saf doğrulama ve dönüştürme.
// Biçim: docs/yemek-verisi/SABLON.json, talimat: docs/yemek-verisi/TALIMAT.md. Komut: scripts/food-import.mjs.
//
// İlke (CLAUDE.md kural 6): besin değerleri elle yazılmaz, hesaplanır.
//  - besinler: Türkçe ad + USDA SR Legacy eşlemesi (fdc_id ya da tam İngilizce açıklama) → değerler USDA'dan
//  - yemekler: malzeme gramajları + pişmiş ağırlık → değerler computeRecipe ile malzemelerden
//  - urunler: hazır 100 g değerleri (etiket ya da güvenilir dış derleme; kullanıcı kararı 2026-11-07) → olduğu gibi kabul edilir;
//    yalnız fiziksel olarak imkânsız satırlar (per100Problem, şeker > karbonhidrat…) ayrılır. Kaynak isteğe bağlı.
//  - CSV: csvToImport ile aynı `urunler` biçimine çevrilir (toplu veri için).
import { computeRecipe, normalizeSearch, type Nutrients } from './nutrition.ts'
import { isValidBarcode, per100Problem } from './food.ts'

export const IMPORT_FORMAT = 'dgfit-yemek/1'

export type Portion = [string, number]
export interface InFood { ad: string; kategori: string; usda: string | number; porsiyonlar?: Portion[]; esanlamlar?: string[]; anahtar?: string; yaklasik?: boolean }
export interface InDish { ad: string; kategori: string; malzemeler: Record<string, number>; pismis_agirlik: number; porsiyonlar?: Portion[]; esanlamlar?: string[]; anahtar?: string }
export interface InProduct {
  ad: string; marka?: string | null; barkod?: string | null; kategori: string; kaynak?: string | null
  '100g': { kcal: number; protein: number; karbonhidrat: number; yag: number; lif?: number; seker?: number; doymus_yag?: number; sodyum_mg?: number; tuz_g?: number }
  porsiyonlar?: Portion[]; esanlamlar?: string[]; anahtar?: string
  /** CSV'den gelen satırın dosyadaki satır numarası (raporda) */
  _satir?: number
}
export interface ImportFile { format: string; kaynak?: string; besinler?: InFood[]; yemekler?: InDish[]; urunler?: InProduct[] }

/** data/tr-foods.json / tr-dishes.json / tr-products.json satır biçimleri (build_foods.mjs okur). */
export interface TrFood { k: string; tr: string; c: string; usda: string; p: Portion[]; a?: string[]; approx?: boolean }
export interface TrDish { k: string; tr: string; c: string; yield: number; i: Record<string, number>; p: Portion[]; a?: string[] }
export interface TrProduct { k: string; tr: string; brand: string | null; barcode: string | null; c: string; n: Nutrients; p: Portion[]; a?: string[]; src: string }

export interface UsdaFood { id: number; en: string; n: Nutrients }
export interface ImportContext {
  usda: UsdaFood[]
  foods: TrFood[]
  dishes: TrDish[]
  products: TrProduct[]
}

export interface Issue { level: 'hata' | 'uyarı'; where: string; msg: string }
export interface ImportResult {
  issues: Issue[]
  add: { foods: TrFood[]; dishes: TrDish[]; products: TrProduct[] }
  skipped: { where: string; why: string }[]
  /** göz kontrolü için: hesaplanan değerler */
  preview: { where: string; name: string; kcal: number; protein: number; carb: number; fat: number }[]
}

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }
/** "Kırmızı mercimek çorbası" → "kirmizi-mercimek-corbasi" */
export function slug(s: string): string {
  return s.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

/** Kategoriye göre 100 g'da olağan kalori aralığı (dışı uyarı; hata değil). */
const RANGES: [RegExp, number, number][] = [
  [/sebze|yeşillik|salata/i, 5, 180], [/meyve/i, 15, 380], [/içecek|meyve suyu/i, 0, 130], [/çorba/i, 10, 160],
  [/yağ(lar)?$|tereyağ/i, 500, 900], [/kuruyemiş|çerez|tohum/i, 250, 720], [/et|tavuk|balık|kümes|deniz/i, 60, 500],
  [/bakliyat/i, 60, 400], [/tahıl|ekmek|fırın|makarna|pilav|hamur/i, 80, 520], [/tatlı|şekerleme|çikolata/i, 150, 600],
  [/süt|peynir|yoğurt/i, 30, 450], [/sos|baharat/i, 0, 900],
]
export function kcalRange(category: string): [number, number] | null {
  const r = RANGES.find(([re]) => re.test(category))
  return r ? [r[1], r[2]] : null
}

const isNum = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const str = (v: unknown, min = 1, max = 120) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max

function portionsOk(ps: unknown, where: string, issues: Issue[]): Portion[] {
  if (ps === undefined) return []
  if (!Array.isArray(ps)) { issues.push({ level: 'hata', where, msg: 'porsiyonlar bir liste olmalı: [["1 kase", 250], …]' }); return [] }
  const out: Portion[] = []
  for (const p of ps) {
    if (!Array.isArray(p) || !str(p[0], 1, 40) || !isNum(p[1], 1, 3000)) { issues.push({ level: 'hata', where, msg: `geçersiz porsiyon ${JSON.stringify(p)} (ad 1–40 karakter, gram 1–3000)` }); continue }
    out.push([String(p[0]).trim(), Math.round(Number(p[1]))])
  }
  return out
}

/** Yakın USDA açıklamaları (kelime örtüşmesi) — eşleşme bulunamazsa öneri olarak gösterilir. */
export function usdaSuggest(q: string, usda: UsdaFood[], n = 3): string[] {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)
  if (!words.length) return []
  return usda.map((f) => { const e = f.en.toLowerCase(); return { f, s: words.filter((w) => e.includes(w)).length / words.length - e.length / 2000 } })
    .filter((x) => x.s > 0.5).sort((a, b) => b.s - a.s).slice(0, n).map((x) => `${x.f.id} · ${x.f.en}`)
}

/**
 * Dosyayı doğrular ve eklenecek satırları üretir. Hata varsa hiçbir şey eklenmemeli (çağıran denetler).
 * Tekrarlar (aynı anahtar / aynı ad / aynı barkod) eklenmez, "atlandı" listesine yazılır.
 */
export function validateImport(file: unknown, ctx: ImportContext): ImportResult {
  const issues: Issue[] = []
  const skipped: ImportResult['skipped'] = []
  const preview: ImportResult['preview'] = []
  const add: ImportResult['add'] = { foods: [], dishes: [], products: [] }
  const f = file as ImportFile
  if (!f || typeof f !== 'object' || f.format !== IMPORT_FORMAT) {
    issues.push({ level: 'hata', where: 'dosya', msg: `"format": "${IMPORT_FORMAT}" alanı gerekli` })
    return { issues, add, skipped, preview }
  }
  if ((f as { $sablon?: unknown }).$sablon) {
    issues.push({ level: 'hata', where: 'dosya', msg: 'Bu şablon dosyası (örnek kayıtlar). "$sablon" satırını ve örnekleri silip kendi verinle doldur.' })
    return { issues, add, skipped, preview }
  }
  const byId = new Map(ctx.usda.map((u) => [u.id, u]))
  const byEn = new Map(ctx.usda.map((u) => [u.en, u]))
  // ad / anahtar → mevcut satırlar (tekrar ayıklama)
  const names = new Map<string, string>() // normalize(ad) → anahtar
  const keys = new Set<string>()
  const barcodes = new Set<string>()
  for (const x of [...ctx.foods, ...ctx.dishes]) { keys.add(x.k); names.set(normalizeSearch(x.tr), x.k) }
  for (const x of ctx.products) { keys.add(x.k); names.set(normalizeSearch(x.brand ? `${x.tr} ${x.brand}` : x.tr), x.k) }
  for (const p of ctx.products) if (p.barcode) barcodes.add(p.barcode)
  const usdaOf = new Map<string, Nutrients>() // anahtar → 100 g değerleri (tarif malzemesi için)
  for (const x of ctx.foods) { const u = byEn.get(x.usda); if (u) usdaOf.set(x.k, u.n) }
  for (const x of ctx.products) usdaOf.set(x.k, x.n)

  const claim = (where: string, ad: string, anahtar: string | undefined): string | null => {
    const k = anahtar && /^[a-z0-9-]{2,60}$/.test(anahtar) ? anahtar : slug(ad)
    if (!k) { issues.push({ level: 'hata', where, msg: 'ad boş ya da geçersiz' }); return null }
    const dupName = names.get(normalizeSearch(ad))
    if (keys.has(k) || dupName) { skipped.push({ where, why: `zaten var (${dupName ?? k})` }); return null }
    keys.add(k); names.set(normalizeSearch(ad), k)
    return k
  }
  const aliases = (a: unknown, where: string): string[] | undefined => {
    if (a === undefined) return undefined
    if (!Array.isArray(a) || a.some((x) => !str(x, 2, 60))) { issues.push({ level: 'uyarı', where, msg: 'esanlamlar 2–60 karakterlik metin listesi olmalı; yok sayıldı' }); return undefined }
    return [...new Set(a.map((x: string) => x.trim().toLocaleLowerCase('tr-TR')))].slice(0, 8)
  }
  const outlier = (where: string, cat: string, kcal: number) => {
    const r = kcalRange(cat)
    if (r && (kcal < r[0] || kcal > r[1])) issues.push({ level: 'uyarı', where, msg: `100 g'da ${Math.round(kcal)} kcal, "${cat}" için olağan aralık ${r[0]}–${r[1]} kcal; değerleri kontrol et` })
  }

  // 1) besinler (USDA eşlemesi)
  for (const [i, x] of (f.besinler ?? []).entries()) {
    const where = `besinler[${i}] ${x?.ad ?? ''}`.trim()
    if (!str(x?.ad, 2, 80) || !str(x?.kategori, 2, 40)) { issues.push({ level: 'hata', where, msg: 'ad (2–80) ve kategori (2–40) gerekli' }); continue }
    const u = typeof x.usda === 'number' ? byId.get(x.usda) : /^\d+$/.test(String(x.usda ?? '')) ? byId.get(Number(x.usda)) : byEn.get(String(x.usda ?? ''))
    if (!u) {
      const sug = usdaSuggest(String(x.usda ?? x.ad), ctx.usda)
      issues.push({ level: 'hata', where, msg: `USDA eşlemesi bulunamadı: ${JSON.stringify(x.usda)}${sug.length ? ` — yakın olanlar: ${sug.join(' | ')}` : ''}` })
      continue
    }
    const p = portionsOk(x.porsiyonlar, where, issues)
    const k = claim(where, x.ad, x.anahtar)
    if (!k) continue
    const a = aliases(x.esanlamlar, where)
    add.foods.push({ k, tr: x.ad.trim(), c: x.kategori.trim(), usda: u.en, p, ...(a ? { a } : {}), ...(x.yaklasik ? { approx: true } : {}) })
    usdaOf.set(k, u.n)
    outlier(where, x.kategori, u.n.kcal ?? 0)
    preview.push({ where, name: x.ad, kcal: u.n.kcal ?? 0, protein: u.n.protein ?? 0, carb: u.n.carb ?? 0, fat: u.n.fat ?? 0 })
  }

  // 2) paketli ürünler (etiket)
  for (const [i, x] of (f.urunler ?? []).entries()) {
    const where = (x?._satir ? `satır ${x._satir} ${x?.ad ?? ''}` : `urunler[${i}] ${x?.ad ?? ''}`).trim()
    if (!str(x?.ad, 2, 80) || !str(x?.kategori, 2, 40)) { issues.push({ level: 'hata', where, msg: 'ad (2–80 karakter) ve kategori (2–40) gerekli' }); continue }
    const v = x['100g']
    if (!v || !isNum(v.kcal, 0, 900) || !isNum(v.protein, 0, 100) || !isNum(v.karbonhidrat, 0, 100) || !isNum(v.yag, 0, 100)) { issues.push({ level: 'hata', where, msg: '"100g" içinde kcal, protein, karbonhidrat, yag sayı olarak gerekli' }); continue }
    const n: Nutrients = { kcal: v.kcal, protein: v.protein, carb: v.karbonhidrat, fat: v.yag }
    if (isNum(v.lif, 0, 100)) n.fiber = v.lif
    if (isNum(v.seker, 0, 100)) n.sugar = v.seker
    if (isNum(v.doymus_yag, 0, 100)) n.satFat = v.doymus_yag
    if (isNum(v.sodyum_mg, 0, 40000)) n.sodium = v.sodyum_mg
    else if (isNum(v.tuz_g, 0, 100)) n.sodium = Math.round(v.tuz_g! * 400) // tuz (g) × 400 = sodyum (mg)
    const bad = per100Problem({ kcal: v.kcal, protein: v.protein, carb: v.karbonhidrat, fat: v.yag })
    if (bad) { issues.push({ level: 'hata', where, msg: bad }); continue }
    if ((n.sugar ?? 0) > (n.carb ?? 0) + 0.5) { issues.push({ level: 'hata', where, msg: 'şeker karbonhidrattan fazla olamaz' }); continue }
    if ((n.satFat ?? 0) > (n.fat ?? 0) + 0.5) { issues.push({ level: 'hata', where, msg: 'doymuş yağ toplam yağdan fazla olamaz' }); continue }
    let code = x.barkod ? String(x.barkod).replace(/\s/g, '') : null
    // geçersiz barkod satırı düşürmez: ürün barkodsuz eklenir (aramayla bulunur), uyarı verilir
    if (code && !isValidBarcode(code)) { issues.push({ level: 'uyarı', where, msg: `barkod geçersiz (sağlama basamağı tutmuyor), barkodsuz eklendi: ${code}` }); code = null }
    if (code && barcodes.has(code)) { skipped.push({ where, why: `barkod zaten var (${code})` }); continue }
    const p = portionsOk(x.porsiyonlar, where, issues)
    const k = claim(where, x.marka ? `${x.ad} ${x.marka}` : x.ad, x.anahtar)
    if (!k) continue
    if (code) barcodes.add(code)
    const a = aliases(x.esanlamlar, where)
    add.products.push({ k, tr: x.ad.trim(), brand: x.marka?.trim() || null, barcode: code, c: x.kategori.trim(), n, p, ...(a ? { a } : {}), src: (typeof x.kaynak === 'string' && x.kaynak.trim()) || (typeof f.kaynak === 'string' && f.kaynak.trim()) || 'Dış veri derlemesi' })
    usdaOf.set(k, n)
    outlier(where, x.kategori, v.kcal)
    preview.push({ where, name: x.ad, kcal: v.kcal, protein: v.protein, carb: v.karbonhidrat, fat: v.yag })
  }

  // 3) yemekler (tarif → hesap); malzemeler anahtar ya da ad ile (bu dosyadaki besinler dahil)
  const keyOf = (s: string) => (usdaOf.has(s) ? s : names.get(normalizeSearch(s)) ?? null)
  for (const [i, x] of (f.yemekler ?? []).entries()) {
    const where = `yemekler[${i}] ${x?.ad ?? ''}`.trim()
    if (!str(x?.ad, 2, 80) || !str(x?.kategori, 2, 40) || !isNum(x?.pismis_agirlik, 50, 20000) || !x.malzemeler || typeof x.malzemeler !== 'object') { issues.push({ level: 'hata', where, msg: 'ad, kategori, malzemeler ({anahtar: gram}) ve pismis_agirlik (50–20000 g) gerekli' }); continue }
    const ings: { per100: Nutrients; grams: number }[] = []
    const i2: Record<string, number> = {}
    let miss = false
    for (const [m, g] of Object.entries(x.malzemeler)) {
      const k = keyOf(m)
      if (!k || !isNum(g, 0.1, 10000)) { issues.push({ level: 'hata', where, msg: !k ? `malzeme bulunamadı: "${m}" (önce "besinler"e ekle ya da mevcut anahtarı kullan)` : `malzeme gramı geçersiz: ${m}` }); miss = true; continue }
      ings.push({ per100: usdaOf.get(k)!, grams: g }); i2[k] = g
    }
    if (miss || !ings.length) continue
    const r = computeRecipe(ings, x.pismis_agirlik)
    if (x.pismis_agirlik > r.rawGrams * 1.3 || x.pismis_agirlik < r.rawGrams * 0.4) { issues.push({ level: 'hata', where, msg: `pişmiş ağırlık ${x.pismis_agirlik} g, çiğ toplam ${Math.round(r.rawGrams)} g ile tutarsız (%40–130 arası olmalı)` }); continue }
    const p = portionsOk(x.porsiyonlar, where, issues)
    const k = claim(where, x.ad, x.anahtar)
    if (!k) continue
    const a = aliases(x.esanlamlar, where)
    add.dishes.push({ k, tr: x.ad.trim(), c: x.kategori.trim(), yield: Math.round(x.pismis_agirlik), i: i2, p, ...(a ? { a } : {}) })
    outlier(where, x.kategori, r.per100.kcal ?? 0)
    preview.push({ where, name: x.ad, kcal: Math.round(r.per100.kcal ?? 0), protein: r.per100.protein ?? 0, carb: r.per100.carb ?? 0, fat: r.per100.fat ?? 0 })
  }
  return { issues, add, skipped, preview }
}

// ───────── CSV (toplu veri) ─────────
/** CSV satırlarını ayırır: tırnaklı alanlar, "" kaçışı, virgül ya da noktalı virgül (ilk satıra göre). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '')
  const first = t.split(/\r?\n/, 1)[0] ?? ''
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : (first.includes('\t') && !first.includes(',') ? '\t' : ',')
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x.trim())) rows.push(row); row = []; cell = '' }
    else cell += c
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

const HEAD: Record<string, string> = {
  ad: 'ad', isim: 'ad', urun: 'ad', 'ürün': 'ad', kategori: 'kategori', marka: 'marka', barkod: 'barkod',
  kcal: 'kcal', kalori: 'kcal', enerji: 'kcal', protein: 'protein', karbonhidrat: 'karbonhidrat', karb: 'karbonhidrat', yag: 'yag', 'yağ': 'yag',
  lif: 'lif', seker: 'seker', 'şeker': 'seker', doymus_yag: 'doymus_yag', 'doymuş_yağ': 'doymus_yag', sodyum_mg: 'sodyum_mg', tuz_g: 'tuz_g',
  porsiyonlar: 'porsiyonlar', porsiyon: 'porsiyonlar', esanlamlar: 'esanlamlar', 'eşanlamlar': 'esanlamlar', kaynak: 'kaynak',
}
const numTr = (s: string | undefined) => { if (s === undefined || !s.trim()) return undefined; const v = Number(s.trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : NaN }

/**
 * CSV → `dgfit-yemek/1` (yalnız `urunler`). Başlıklar (sıra serbest): ad, kategori, marka, barkod, kcal, protein, karbonhidrat,
 * yag, lif, seker, doymus_yag, sodyum_mg, tuz_g, porsiyonlar ("1 adet=30|1 paket=150"), esanlamlar ("a|b"), kaynak.
 * Ondalık virgül de olur (noktalı virgülle ayrılmış dosyada).
 */
export function csvToImport(text: string, kaynak?: string): ImportFile {
  const rows = parseCsv(text)
  if (!rows.length) return { format: IMPORT_FORMAT, urunler: [] }
  const cols = rows[0].map((h) => HEAD[h.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '_')] ?? null)
  const urunler: InProduct[] = []
  for (const [ri, r] of rows.slice(1).entries()) {
    const o: Record<string, string> = {}
    cols.forEach((c, i) => { if (c && r[i] !== undefined) o[c] = r[i].trim() })
    const num = (k: string) => numTr(o[k])
    const g: InProduct['100g'] = { kcal: num('kcal') as number, protein: num('protein') as number, karbonhidrat: num('karbonhidrat') as number, yag: num('yag') as number }
    for (const k of ['lif', 'seker', 'doymus_yag', 'sodyum_mg', 'tuz_g'] as const) { const v = num(k); if (v !== undefined && !Number.isNaN(v)) g[k] = v }
    const porsiyonlar = o.porsiyonlar ? o.porsiyonlar.split(/[;|]/).map((x) => x.split('=')).filter((x) => x.length === 2).map(([l, v]) => [l.trim(), numTr(v) ?? NaN] as Portion) : undefined
    urunler.push({
      ad: o.ad ?? '', kategori: o.kategori ?? '', marka: o.marka || null, barkod: o.barkod || null, '100g': g,
      ...(porsiyonlar?.length ? { porsiyonlar } : {}), ...(o.esanlamlar ? { esanlamlar: o.esanlamlar.split('|').map((x) => x.trim()).filter(Boolean) } : {}),
      ...(o.kaynak ? { kaynak: o.kaynak } : {}), _satir: ri + 2,
    })
  }
  return { format: IMPORT_FORMAT, ...(kaynak ? { kaynak } : {}), urunler }
}
