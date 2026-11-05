// Koç eylemleri ve "ne olur" kartı için hesaplar — saf, testli (tests/coach.test.ts).
// Dil modeli yalnızca besin adı + gram ya da eylem türü önerir; sayıları buradaki Fit motoru fonksiyonları üretir.
import { closureDiff, distributeDiff, type Adjustment, type PlanDay } from './fit.ts'
import { normalizeSearch } from './nutrition.ts'

export interface WhatIf {
  items: { name: string; grams: number; foodName: string | null; kcal: number | null }[]
  kcal: number // eşleşen besinlerin toplamı
  remainingBefore: number // bugünkü bütçe (hedef + egzersiz − yenen)
  remainingAfter: number
  diff: number // gün böyle kapanırsa dağıtılacak fark (closureDiff)
  spread: Adjustment[] // sonraki günlere etkisi
  leftover: number
  unmatched: number
}

/** "Bunu yersem ne olur": gün kapanışı ve dağıtım Fit motoruyla aynı kurallarla önizlenir. */
export function whatIfImpact(i: {
  items: { name: string; grams: number; foodName: string | null; kcal: number | null }[]
  target: number; eaten: number; burned: number; itemCount: number; upcoming: PlanDay[]; floor: number
}): WhatIf {
  const kcal = Math.round(i.items.reduce((a, x) => a + (x.kcal ?? 0), 0))
  const remainingBefore = Math.round(i.target + i.burned - i.eaten)
  const c = closureDiff({ eaten: i.eaten + kcal, target: i.target, burned: i.burned, items: i.itemCount + i.items.length })
  const r = c.diff > 0 ? distributeDiff(c.diff, i.upcoming, i.floor) : { adjustments: [], leftover: 0 }
  return { items: i.items, kcal, remainingBefore, remainingAfter: remainingBefore - kcal, diff: c.diff > 0 ? c.diff : 0, spread: r.adjustments, leftover: r.leftover, unmatched: i.items.filter((x) => x.kcal === null).length }
}

/** Koçun söylediği gün adını aktif programın günleriyle eşleştirir (tam → içerir → harf/numara). */
export function matchProgramDay<T extends { id: string; name: string }>(name: string, days: T[]): T | null {
  const n = normalizeSearch(name)
  if (!n || !days.length) return null
  const norm = days.map((d) => ({ d, k: normalizeSearch(d.name) }))
  return norm.find((x) => x.k === n)?.d
    ?? norm.find((x) => x.k.includes(n) || n.includes(x.k))?.d
    ?? norm.find((x) => { const t = n.split(' ').at(-1)!; return t.length <= 2 && x.k.split(' ').includes(t) })?.d
    ?? null
}

export const MAX_GOAL_DAYS = 730

/** Hedef tarihi değişikliği: yeni bitiş ve kalan gün; kısaltma güvenlik kontrolünü çağıran `computePlan` ile yapar. */
export function shiftGoal(endDate: string, today: string, weeks: number): { newEnd: string; daysLeft: number } | { error: string } {
  if (!Number.isInteger(weeks) || weeks === 0 || Math.abs(weeks) > 12) return { error: 'Geçersiz hafta sayısı' }
  const ms = Date.parse(endDate + 'T12:00:00Z') + weeks * 7 * 86400000
  const newEnd = new Date(ms).toISOString().slice(0, 10)
  const daysLeft = Math.round((ms - Date.parse(today + 'T12:00:00Z')) / 86400000)
  if (daysLeft < 7) return { error: 'Hedef tarihi bugünden en az 1 hafta sonra olmalı' }
  if (daysLeft > MAX_GOAL_DAYS) return { error: 'Hedef tarihi en fazla 2 yıl sonrası olabilir' }
  return { newEnd, daysLeft }
}
