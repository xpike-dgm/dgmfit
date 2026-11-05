// Menü, alışveriş listesi, elimdekiler ve restoran modu hesapları — saf, testli (tests/planner.test.ts).
// Dil modeli yalnızca besin adı + gram önerir; kalori/makro, ölçekleme, birleştirme ve sıralama burada yapılır (spesifikasyon 6.4, 10).
import type { Nutrients } from './nutrition.ts'
import { macrosFor, type Macros } from './food.ts'

export interface PlanItem { name: string; foodId: number | null; grams: number; per100: Nutrients | null }
export const MIN_SCALE = 0.7, MAX_SCALE = 1.35

const round5 = (g: number) => Math.max(5, Math.round(g / 5) * 5)

/** Kalemlerin toplam makrosu (eşleşmeyenler 0). */
export function itemsMacros(items: PlanItem[]): Macros {
  const out = { kcal: 0, protein: 0, carb: 0, fat: 0 }
  for (const it of items) {
    if (!it.per100) continue
    const m = macrosFor(it.per100, it.grams)
    out.kcal += m.kcal; out.protein += m.protein; out.carb += m.carb; out.fat += m.fat
  }
  return { kcal: Math.round(out.kcal), protein: Math.round(out.protein), carb: Math.round(out.carb), fat: Math.round(out.fat) }
}

/**
 * Bir günün (ya da tarifin) gramlarını hedef kaloriye tek katsayıyla ölçekler (0,7–1,35; 5 g'a yuvarlı, kalem başına 10–800 g).
 * Ölçek sınırına takılırsa kalan fark `off` olarak döner (kullanıcıya gösterilir).
 */
export function scaleToKcal(items: PlanItem[], targetKcal: number): { items: PlanItem[]; factor: number; macros: Macros; off: number } {
  const before = itemsMacros(items).kcal
  if (before <= 0 || targetKcal <= 0) return { items, factor: 1, macros: itemsMacros(items), off: Math.round(before - targetKcal) }
  const factor = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetKcal / before))
  const scaled = items.map((it) => (it.per100 ? { ...it, grams: Math.min(800, Math.max(10, round5(it.grams * factor))) } : it))
  const macros = itemsMacros(scaled)
  return { items: scaled, factor: Math.round(factor * 100) / 100, macros, off: macros.kcal - Math.round(targetKcal) }
}

// ───────── Alışveriş listesi ─────────

export const AISLES = ['Manav', 'Kasap ve balık', 'Süt ürünleri ve kahvaltılık', 'Fırın', 'Kuru gıda ve bakliyat', 'Yağ, sos ve baharat', 'İçecek', 'Diğer'] as const
export type Aisle = (typeof AISLES)[number]
const AISLE_BY_CATEGORY: Record<string, Aisle> = {
  'Sebzeler': 'Manav', 'Meyveler': 'Manav', 'Et, tavuk, balık': 'Kasap ve balık', 'Süt ürünleri': 'Süt ürünleri ve kahvaltılık', 'Kahvaltılık': 'Süt ürünleri ve kahvaltılık', 'Yumurta': 'Süt ürünleri ve kahvaltılık',
  'Ekmek ve hamur işi': 'Fırın', 'Hamur işleri': 'Fırın', 'Tahıllar': 'Kuru gıda ve bakliyat', 'Bakliyat': 'Kuru gıda ve bakliyat', 'Pilav ve makarna': 'Kuru gıda ve bakliyat', 'Kuruyemiş': 'Kuru gıda ve bakliyat',
  'Atıştırmalık': 'Kuru gıda ve bakliyat', 'Tatlandırıcılar': 'Kuru gıda ve bakliyat', 'Yağlar': 'Yağ, sos ve baharat', 'Soslar': 'Yağ, sos ve baharat', 'Baharat': 'Yağ, sos ve baharat', 'İçecekler': 'İçecek',
}
export const aisleOf = (category: string | null | undefined): Aisle => (category ? AISLE_BY_CATEGORY[category] ?? 'Diğer' : 'Diğer')

export interface ShopSource { name: string; grams: number; category: string | null; recipe: { yield: number; ingredients: { g: number; key: string; name: string }[] } | null }
export interface ShopLine { name: string; grams: number; aisle: Aisle }
const SKIP = new Set(['su']) // musluk suyu alışverişe yazılmaz

/**
 * Menü kalemlerinden alışveriş listesi: hazır yemekler tarif malzemelerine açılır (gram × malzeme / pişmiş ağırlık),
 * aynı malzeme birleşir, 10 g'a yukarı yuvarlanır, reyon ve ada göre sıralanır.
 */
export function shoppingList(items: ShopSource[], categoryOfKey: (key: string) => string | null): ShopLine[] {
  const acc = new Map<string, ShopLine>()
  const add = (name: string, grams: number, aisle: Aisle) => {
    if (SKIP.has(name.toLocaleLowerCase('tr-TR')) || grams <= 0) return
    const k = name.toLocaleLowerCase('tr-TR')
    const cur = acc.get(k)
    if (cur) cur.grams += grams
    else acc.set(k, { name, grams, aisle })
  }
  for (const it of items) {
    if (it.recipe && it.recipe.yield > 0 && it.recipe.ingredients.length) {
      for (const ing of it.recipe.ingredients) add(ing.name, (it.grams * ing.g) / it.recipe.yield, aisleOf(categoryOfKey(ing.key)))
    } else add(it.name, it.grams, aisleOf(it.category))
  }
  return [...acc.values()].map((l) => ({ ...l, grams: Math.ceil(l.grams / 10) * 10 }))
    .sort((a, b) => AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) || a.name.localeCompare(b.name, 'tr'))
}

// ───────── Restoran modu ─────────

export interface DishOption { name: string; food: string | null; grams: number; kcal: number | null; protein: number | null }
export interface RankedDish extends DishOption { fits: boolean; over: number; score: number }

/**
 * Kalan bütçeye en uygun seçenekler: bütçeyi aşmayanlar önce; aşmayanlarda kalan bütçenin %35–90'ını dolduran ve
 * protein yoğunluğu yüksek olan üstte; aşanlarda en az aşan. Kalorisi bilinmeyenler sona.
 */
export function rankDishes(opts: DishOption[], remainingKcal: number, n = 3): RankedDish[] {
  const budget = Math.max(0, remainingKcal)
  const r = opts.map((o): RankedDish => {
    if (o.kcal === null) return { ...o, fits: false, over: 0, score: -1e9 }
    const over = Math.max(0, Math.round(o.kcal - budget))
    const fill = budget > 0 ? o.kcal / budget : 2
    const density = o.kcal > 0 ? ((o.protein ?? 0) * 4) / o.kcal : 0 // proteinden gelen kalori oranı
    const fillScore = fill >= 0.35 && fill <= 0.9 ? 1 : fill < 0.35 ? fill / 0.35 : Math.max(0, 1 - (fill - 0.9) * 2)
    const score = over > 0 ? -over : 100 + fillScore * 50 + density * 100
    return { ...o, fits: over === 0, over, score: Math.round(score * 10) / 10 }
  })
  return r.sort((a, b) => b.score - a.score).slice(0, n)
}
