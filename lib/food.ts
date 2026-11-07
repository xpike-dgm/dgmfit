// Yemek modülü saf yardımcıları — testli (tests/food.test.ts).
import { normalizeSearch, type Nutrients } from './nutrition.ts'

export type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEALS: { id: MealId; label: string; share: number }[] = [
  { id: 'breakfast', label: 'Kahvaltı', share: 0.25 },
  { id: 'lunch', label: 'Öğle yemeği', share: 0.35 },
  { id: 'dinner', label: 'Akşam yemeği', share: 0.3 },
  { id: 'snack', label: 'Ara öğün', share: 0.1 },
]
export const MEAL_LABEL: Record<MealId, string> = Object.fromEntries(MEALS.map((m) => [m.id, m.label])) as Record<MealId, string>

/** Günün saatine göre önerilen öğün (gün içi dakika). */
export function mealForTime(min: number): MealId {
  if (min >= 5 * 60 && min < 10 * 60 + 30) return 'breakfast'
  if (min >= 11 * 60 + 30 && min < 15 * 60) return 'lunch'
  if (min >= 18 * 60 && min < 22 * 60) return 'dinner'
  return 'snack'
}

export interface Macros { kcal: number; protein: number; carb: number; fat: number }

export function macrosFor(per100: Nutrients, grams: number): Macros {
  const f = grams / 100
  return {
    kcal: Math.round((per100.kcal ?? 0) * f),
    protein: round1((per100.protein ?? 0) * f),
    carb: round1((per100.carb ?? 0) * f),
    fat: round1((per100.fat ?? 0) * f),
  }
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: round1(a.protein + m.protein), carb: round1(a.carb + m.carb), fat: round1(a.fat + m.fat) }), { kcal: 0, protein: 0, carb: 0, fat: 0 })
}

/** Porsiyon seçimi → gram. qty 0'dan büyük olmalı. */
export function portionGrams(portion: { g: number }, qty: number): number {
  if (!(qty > 0) || !(portion.g > 0)) throw new Error('geçersiz porsiyon')
  return Math.round(portion.g * qty * 10) / 10
}

/** Kaydın bütçeye etkisi: "Bu öğün kalan bütçenin %42'si". */
export function budgetImpact(kcal: number, remainingBefore: number): { pct: number | null; over: boolean } {
  if (remainingBefore <= 0) return { pct: null, over: true }
  return { pct: Math.round((kcal / remainingBefore) * 100), over: kcal > remainingBefore }
}

export interface OffMapped {
  nameTr: string
  brand: string | null
  barcode: string
  per100: Nutrients
  portions: { label: string; g: number }[]
  imageUrl: string | null
  search: string
}

/**
 * Open Food Facts v2 ürün yanıtını besin satırına çevirir. 100 g başına değerler zorunlu; yoksa null.
 * Sodyum OFF'ta gram cinsindendir → mg. Enerji yalnızca kJ ise kcal'e çevrilir (÷4,184).
 */
export function mapOffProduct(code: string, p: Record<string, unknown> | null | undefined): OffMapped | null {
  if (!p) return null
  const n = (p.nutriments ?? {}) as Record<string, number | string | undefined>
  const num = (k: string) => { const v = n[k]; const x = typeof v === 'string' ? Number(v) : v; return typeof x === 'number' && Number.isFinite(x) ? x : undefined }
  let kcal = num('energy-kcal_100g')
  if (kcal === undefined) { const kj = num('energy-kj_100g') ?? num('energy_100g'); if (kj !== undefined) kcal = kj / 4.184 }
  const protein = num('proteins_100g'), carb = num('carbohydrates_100g'), fat = num('fat_100g')
  if (kcal === undefined || protein === undefined || carb === undefined || fat === undefined) return null
  const name = String(p.product_name_tr || p.product_name || p.generic_name_tr || p.generic_name || '').trim()
  if (!name) return null
  const per100: Nutrients = { kcal: Math.round(kcal), protein: round1(protein), carb: round1(carb), fat: round1(fat) }
  if (per100Problem({ kcal: per100.kcal!, protein: per100.protein!, carb: per100.carb!, fat: per100.fat! })) return null // OFF'ta hatalı girilmiş ürün
  const opt: [string, keyof Nutrients, number][] = [['fiber_100g', 'fiber', 1], ['sugars_100g', 'sugar', 1], ['saturated-fat_100g', 'satFat', 1], ['sodium_100g', 'sodium', 1000]]
  for (const [k, key, mul] of opt) { const v = num(k); if (v !== undefined) per100[key] = round1(v * mul) }
  const brand = String(p.brands ?? '').split(',')[0].trim() || null
  const portions: { label: string; g: number }[] = []
  const sq = Number(p.serving_quantity)
  if (Number.isFinite(sq) && sq > 0 && sq < 2000) portions.push({ label: `1 porsiyon (${p.serving_size ?? `${sq} g`})`, g: round1(sq) })
  const q = String(p.quantity ?? '').match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i)
  if (q) { const g = Number(q[1].replace(',', '.')); if (g > 0 && g < 5000) portions.push({ label: `1 paket (${q[1]} ${q[2].toLowerCase()})`, g }) }
  portions.push({ label: '100 g', g: 100 })
  const img = typeof p.image_front_small_url === 'string' && /^https:\/\//.test(p.image_front_small_url) ? p.image_front_small_url : null
  return { nameTr: name.slice(0, 120), brand: brand?.slice(0, 60) ?? null, barcode: code, per100, portions, imageUrl: img, search: normalizeSearch([name, brand].filter(Boolean).join(' ')) }
}

/**
 * 100 g başına değerler fiziksel olarak mümkün mü? Hata metni ya da null.
 * Enerji–makro (Atwater 4/4/9) uyumu: makrolardan gelen enerji 20 kcal'i aşıyorsa beyan edilen kalori
 * bunun %60'ı ile %160'ı (+80; alkol, poliol payı) arasında olmalı.
 * Makro toplamı: etiketler yuvarlanır ve analiz payı içerir (çoğu etikette "±%10"), bu yüzden 100 g'ı biraz aşan
 * toplamlar gerçek etikettir (ör. gainer: 19 + 81,2 + 0,4 = 100,6 g); 105 g'a kadar kabul edilir.
 */
export const MACRO_SUM_MAX = 105
export function per100Problem(v: { kcal: number; protein: number; carb: number; fat: number }): string | null {
  if ([v.kcal, v.protein, v.carb, v.fat].some((x) => !Number.isFinite(x) || x < 0)) return 'Değerler negatif olamaz'
  if (v.kcal > 900) return '100 g başına kalori 900\'ü geçemez (saf yağ ~900)'
  if (v.protein + v.carb + v.fat > MACRO_SUM_MAX) return `100 g başına protein + karbonhidrat + yağ toplamı ${MACRO_SUM_MAX} g'ı geçemez; değerleri kontrol et`
  const atw = v.protein * 4 + v.carb * 4 + v.fat * 9
  if (atw > 20 && (v.kcal < atw * 0.6 - 20 || v.kcal > atw * 1.6 + 80)) return `Kalori makrolarla uyuşmuyor (makrolardan ≈${Math.round(atw)} kcal). Değerleri kontrol et.`
  return null
}

export function isValidBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false
  const d = code.split('').map(Number)
  const check = d.pop()!
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

function round1(v: number) { return Math.round(v * 10) / 10 }
