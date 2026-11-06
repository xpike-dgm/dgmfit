// Besin değeri hesapları — saf, testli (tests/nutrition.test.ts). Tüm değerler 100 g başına tutulur.

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carb', 'fat', 'fiber', 'sugar', 'satFat', 'sodium', 'water', 'chol', 'ca', 'fe', 'k', 'vitC', 'vitD', 'vitA', 'mg', 'zn', 'b6', 'b12'] as const
export type NutrientKey = (typeof NUTRIENT_KEYS)[number]
export type Nutrients = Partial<Record<NutrientKey, number>>

export const NUTRIENT_INFO: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: 'Enerji', unit: 'kcal' }, protein: { label: 'Protein', unit: 'g' }, carb: { label: 'Karbonhidrat', unit: 'g' },
  fat: { label: 'Yağ', unit: 'g' }, fiber: { label: 'Lif', unit: 'g' }, sugar: { label: 'Şeker', unit: 'g' }, satFat: { label: 'Doymuş yağ', unit: 'g' },
  sodium: { label: 'Sodyum', unit: 'mg' }, water: { label: 'Su', unit: 'g' }, chol: { label: 'Kolesterol', unit: 'mg' }, ca: { label: 'Kalsiyum', unit: 'mg' },
  fe: { label: 'Demir', unit: 'mg' }, k: { label: 'Potasyum', unit: 'mg' }, vitC: { label: 'C vitamini', unit: 'mg' }, vitD: { label: 'D vitamini', unit: 'µg' },
  vitA: { label: 'A vitamini', unit: 'µg' }, mg: { label: 'Magnezyum', unit: 'mg' }, zn: { label: 'Çinko', unit: 'mg' }, b6: { label: 'B6 vitamini', unit: 'mg' }, b12: { label: 'B12 vitamini', unit: 'µg' },
}

/** 100 g başına değerden belirli gramajın değeri. */
export function forGrams(per100: Nutrients, grams: number): Nutrients {
  const out: Nutrients = {}
  for (const k of NUTRIENT_KEYS) if (per100[k] !== undefined) out[k] = (per100[k]! * grams) / 100
  return out
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {}
  for (const n of list) for (const k of NUTRIENT_KEYS) if (n[k] !== undefined) out[k] = (out[k] ?? 0) + n[k]!
  return out
}

export interface RecipeIngredient { per100: Nutrients; grams: number }

/**
 * Tarif: malzemelerin toplam besin değeri, pişmiş toplam ağırlığa (yieldGrams) bölünerek 100 g başına verilir.
 * yieldGrams verilmezse çiğ toplam ağırlık kullanılır. Bir besin, malzemelerden birinde eksikse sonuçta da
 * "bilinmiyor" sayılmaz; yalnızca tüm malzemelerde bulunan anahtarlar kesin kabul edilir (missing listesi döner).
 */
export function computeRecipe(ings: RecipeIngredient[], yieldGrams?: number): { per100: Nutrients; total: Nutrients; rawGrams: number; yieldGrams: number; missing: NutrientKey[] } {
  const rawGrams = ings.reduce((a, i) => a + i.grams, 0)
  const y = yieldGrams && yieldGrams > 0 ? yieldGrams : rawGrams
  if (!(y > 0)) throw new Error('tarif ağırlığı 0')
  const total = sumNutrients(ings.map((i) => forGrams(i.per100, i.grams)))
  const missing = NUTRIENT_KEYS.filter((k) => ings.some((i) => i.grams > 0 && i.per100[k] === undefined && k !== 'water'))
  const per100: Nutrients = {}
  for (const k of NUTRIENT_KEYS) if (total[k] !== undefined) per100[k] = round((total[k]! * 100) / y, k === 'sodium' ? 0 : k === 'kcal' ? 1 : 2)
  // su: pişirmede kaybolan ağırlık sudur
  if (total.water !== undefined) per100.water = round(((total.water - (rawGrams - y)) * 100) / y, 1)
  return { per100, total, rawGrams, yieldGrams: y, missing }
}

/** Atwater (4/4/9) ile makrolardan kalori — veri tutarlılık kontrolü için. */
export function atwaterKcal(n: Nutrients): number {
  return (n.protein ?? 0) * 4 + (n.carb ?? 0) * 4 + (n.fat ?? 0) * 9
}

export function round(v: number, d = 1): number {
  const m = 10 ** d
  return Math.round(v * m) / m
}

/** Türkçe karakter ve büyük/küçük harf duyarsız arama metni. */
export function normalizeSearch(s: string): string {
  return s.toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u')
    .replace(/[^a-z0-9%]+/g, ' ').trim()
}

const STOP = new Set(['ve', 'ile', 'bir', 'de', 'da', 'icin', 'of', 'the', 'and', 'with'])
/**
 * Arama sözcükleri: Türkçe ekleri kırpılmış kökler ("tavuklu pilav" → ["tavuk", "pilav"], "mercimek çorbası" → ["mercimek", "corba"]).
 * Kökler alt dize olarak arandığı için ekli yazımlar ("Tavuklu pilav", "Pirinç pilavı") da eşleşir.
 */
export function searchStems(q: string): string[] {
  const out: string[] = []
  for (const w of normalizeSearch(q).split(' ')) {
    if (w.length < 2 || STOP.has(w)) continue
    let s = w
    const m = /^(.{3,}?)(lari|leri|lar|ler)$/.exec(s) ?? /^(.{3,}?)(li|lu)$/.exec(s) ?? /^(.{4,}?)(si|su)$/.exec(s) ?? /^(.{4,}?)[iu]$/.exec(s)
    if (m) s = m[1]
    if (!out.includes(s)) out.push(s)
  }
  return out.slice(0, 6)
}
