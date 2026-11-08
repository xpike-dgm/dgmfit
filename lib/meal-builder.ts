// Y2: öğün kurucu — kalan makrolara (ve kullanıcının koyduğu üst sınırlara) en yakın 2–3 besinlik kombinasyonlar.
// Saf ve testli (tests/meal-builder.test.ts). Sayılar veritabanındaki 100 g değerlerinden hesaplanır; dil modeli yalnızca
// isteği (sınırlar) iletir, gram ve kalori burada bulunur.

export interface MBFood {
  id: number
  name: string
  per100: { kcal: number; protein: number; carb: number; fat: number }
  /** gram aralığı ve adım (ör. yumurta 50–150 g / 50) */
  minG: number
  maxG: number
  stepG: number
  /** kullanıcının sık yediği besinlere küçük öncelik (0–1) */
  pref?: number
}
export interface Macros4 { kcal: number; protein: number; carb: number; fat: number }
export interface MBLimits { kcal?: number | null; protein?: number | null; carb?: number | null; fat?: number | null }
export interface MBItem { id: number; name: string; grams: number }
export interface MBMeal { items: MBItem[]; totals: Macros4; score: number }

const KEYS = ['kcal', 'protein', 'carb', 'fat'] as const
const r1 = (n: number) => Math.round(n * 10) / 10

export function totalsOf(items: { grams: number; per100: Macros4 }[]): Macros4 {
  const t: Macros4 = { kcal: 0, protein: 0, carb: 0, fat: 0 }
  for (const it of items) for (const k of KEYS) t[k] += (it.per100[k] * it.grams) / 100
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carb: r1(t.carb), fat: r1(t.fat) }
}

/**
 * Hedef: kalan değerler, kullanıcının üst sınırlarıyla kırpılır. Amaç hedefe alttan yaklaşmak; sınır aşımı ağır cezalı,
 * sınır yoksa kalanın %15'ten fazla aşılması cezalı. Kalan negatifse (bütçe dolmuş) 0 kabul edilir.
 */
export function mealTarget(remaining: Macros4, limits: MBLimits = {}): { target: Macros4; cap: Macros4 } {
  const target = {} as Macros4, cap = {} as Macros4
  for (const k of KEYS) {
    const rem = Math.max(0, remaining[k])
    const lim = limits[k] ?? null
    target[k] = lim !== null && lim >= 0 ? Math.min(rem, lim) : rem
    cap[k] = lim !== null && lim >= 0 ? lim : rem * 1.15 + (k === 'kcal' ? 40 : 4)
  }
  return { target, cap }
}

function score(t: Macros4, target: Macros4, cap: Macros4): number {
  let s = 0
  const W = { kcal: 1.2, protein: 1, carb: 0.8, fat: 0.8 }
  for (const k of KEYS) {
    const base = Math.max(target[k], k === 'kcal' ? 150 : 8)
    const d = (t[k] - target[k]) / base
    s += W[k] * d * d
    if (t[k] > cap[k]) { const o = (t[k] - cap[k]) / Math.max(cap[k], k === 'kcal' ? 50 : 3); s += 25 * (o + o * o) }
  }
  return s
}

/** Verilen besin grubu için gramları (aralık ve adım içinde) koordinat inişiyle bulur. */
function fit(foods: MBFood[], target: Macros4, cap: Macros4): { grams: number[]; s: number } {
  const g = foods.map((f) => Math.min(f.maxG, Math.max(f.minG, Math.round(((f.minG + f.maxG) / 2) / f.stepG) * f.stepG)))
  const tot = (gs: number[]) => totalsOf(foods.map((f, i) => ({ grams: gs[i], per100: f.per100 })))
  let best = score(tot(g), target, cap)
  for (let pass = 0; pass < 40; pass++) {
    let improved = false
    for (let i = 0; i < foods.length; i++) {
      for (const dir of [1, -1]) {
        for (const mult of [4, 1]) {
          const ng = g.slice(); ng[i] = Math.min(foods[i].maxG, Math.max(foods[i].minG, g[i] + dir * mult * foods[i].stepG))
          if (ng[i] === g[i]) continue
          const s = score(tot(ng), target, cap)
          if (s < best - 1e-9) { best = s; g[i] = ng[i]; improved = true }
        }
      }
    }
    if (!improved) break
  }
  return { grams: g, s: best }
}

/**
 * En iyi `count` öğün: 2'li ve 3'lü kombinasyonlar denenir (aday sayısı en fazla 28), sonuçlar birbirine benzemesin diye
 * aynı besini paylaşan sonuçlardan yalnız en iyisi alınır (yeterli değilse paylaşanlar da eklenir).
 */
export function buildMeals(i: { remaining: Macros4; limits?: MBLimits; foods: MBFood[]; count?: number; sizes?: number[] }): MBMeal[] {
  const { target, cap } = mealTarget(i.remaining, i.limits)
  if (target.kcal < 60) return []
  const foods = i.foods.slice(0, 28)
  const sizes = i.sizes ?? [2, 3]
  const all: MBMeal[] = []
  const tryCombo = (idx: number[]) => {
    const fs = idx.map((k) => foods[k])
    const { grams, s } = fit(fs, target, cap)
    const pref = fs.reduce((a, f) => a + (f.pref ?? 0), 0) / fs.length
    const items = fs.map((f, k) => ({ id: f.id, name: f.name, grams: grams[k] }))
    const totals = totalsOf(fs.map((f, k) => ({ grams: grams[k], per100: f.per100 })))
    all.push({ items, totals, score: s - 0.04 * pref })
  }
  const n = foods.length
  if (sizes.includes(2)) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) tryCombo([a, b])
  if (sizes.includes(3)) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) tryCombo([a, b, c])
  all.sort((x, y) => x.score - y.score)
  const out: MBMeal[] = [], used = new Set<number>()
  const count = i.count ?? 3
  for (const m of all) { if (out.length >= count) break; if (m.items.some((it) => used.has(it.id))) continue; out.push(m); m.items.forEach((it) => used.add(it.id)) }
  for (const m of all) { if (out.length >= count) break; if (!out.includes(m)) out.push(m) }
  return out
}

/** Kullanıcının metninden üst sınırlar: "maks 20 protein", "en fazla 230 g karbonhidrat", "30 gr yağ olacak", "500 kcal". */
export function parseLimits(text: string): MBLimits {
  const t = text.toLocaleLowerCase('tr').replace(/,/g, '.')
  const out: MBLimits = {}
  const num = '(\\d+(?:\\.\\d+)?)'
  const unit = '\\s*(?:g|gr|gram)?\\s*'
  const pats: [keyof MBLimits, string][] = [['protein', 'protein'], ['carb', 'karbonhidrat|karb|carb'], ['fat', 'yağ|yag|fat'], ['kcal', 'kcal|kalori|cal']]
  for (const [k, w] of pats) {
    const m = t.match(new RegExp(`${num}${unit}(?:${w})`)) ?? t.match(new RegExp(`(?:${w})\\s*(?:en fazla|maks(?:imum)?|max)?\\s*:?\\s*${num}`))
    if (m) out[k] = Number(m[1])
  }
  return out
}

/**
 * Tek öğün için hedef: kalan değerler günün kalanı olabilir (ör. 2.700 kcal); bir öğün bunun tamamı olmamalı.
 * Kullanıcı kalori sınırı vermediyse öğün kalorisi günlük hedefin %40'ı ile sınırlanır (450–1.000 kcal), makrolar aynı oranda.
 */
export function mealShare(remaining: Macros4, dailyKcal: number, limits: MBLimits = {}): Macros4 {
  const cap = limits.kcal ?? Math.min(1000, Math.max(450, Math.round(dailyKcal * 0.4)))
  if (remaining.kcal <= cap) return remaining
  const f = cap / remaining.kcal
  return { kcal: cap, protein: Math.round(remaining.protein * f), carb: Math.round(remaining.carb * f), fat: Math.round(remaining.fat * f) }
}
