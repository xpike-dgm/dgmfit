import 'server-only'
// Y2: koçun veri isteme araçları. Model bağlamda olmayan bir veriye ihtiyaç duyarsa yanıtında `lookups` bırakır; uygulama
// burada sayıları motorlardan hesaplayıp metin olarak döndürür ve koçu bir kez daha çağırır (lib/coach-data.ts).
// Kural: model sayı üretmez; buradaki her sayı veritabanından ve test edilmiş fonksiyonlardan gelir.
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString, diffDays } from './time'
import { fmtNum } from './calc'
import { dayLine } from './coach-calc'
import { WEEKDAY, dow } from './weekly'
import { searchFoods } from './food-data'
import { searchExercises } from './fitness-data'
import { exerciseProgress } from './fitness-stats'
import { MEAL_LABEL, type MealId } from './food'

export interface Lookup { kind: 'gun' | 'donem' | 'hareket' | 'besin'; date: string | null; from: string | null; to: string | null; query: string | null }

const isDay = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const dn = (d: string) => `${d} ${WEEKDAY[dow(d)]}`

async function dayLookup(userId: string, day: string): Promise<string> {
  const { gatherDays } = await import('./coach-data')
  const [d] = await gatherDays(userId, day, day)
  if (!d) return `${dn(day)}: bu gün için hedef yok (hedef başlangıcından önce).`
  const items = await db.select({ meal: schema.mealItems.meal, name: schema.mealItems.name, grams: schema.mealItems.grams, kcal: schema.mealItems.kcal, protein: schema.mealItems.protein })
    .from(schema.mealItems).where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.day, day), isNull(schema.mealItems.deletedAt))).orderBy(asc(schema.mealItems.loggedAt))
  const byMeal = new Map<string, string[]>()
  for (const it of items) (byMeal.get(it.meal) ?? byMeal.set(it.meal, []).get(it.meal)!).push(`${it.name} ${fmtNum(it.grams)} g (${Math.round(it.kcal)} kcal, P ${fmtNum(it.protein, 1)})`)
  const meals = [...byMeal.entries()].map(([m, l]) => `${MEAL_LABEL[m as MealId] ?? m}: ${l.join(', ')}`).join(' | ')
  return dayLine(dn(day), d) + (meals ? ` Öğünler — ${meals}.` : '')
}

async function rangeLookup(userId: string, from: string, to: string): Promise<string> {
  const { gatherDays } = await import('./coach-data')
  if (diffDays(from, to) > 62) from = addDays(to, -62)
  const days = await gatherDays(userId, from, to)
  const logged = days.filter((d) => d.items > 0)
  if (!logged.length) return `${from} – ${to}: bu aralıkta öğün kaydı yok (${days.length} gün).`
  const avg = (f: (d: (typeof days)[number]) => number, list = logged) => Math.round(list.reduce((a, d) => a + f(d), 0) / list.length)
  const over = logged.map((d) => ({ d, diff: d.eaten - (d.target + d.burned) })).sort((a, b) => b.diff - a.diff)
  return `${from} – ${to} (${days.length} gün, ${logged.length} gün öğün kaydı): ortalama ${avg((d) => d.eaten)} kcal (hedef ort. ${avg((d) => d.target)}), protein ${avg((d) => d.protein)}/${avg((d) => d.proteinTarget)} g, karbonhidrat ${avg((d) => d.carb ?? 0)}/${avg((d) => d.carbTarget ?? 0)} g, yağ ${avg((d) => d.fat ?? 0)}/${avg((d) => d.fatTarget ?? 0)} g; su ortalama ${fmtNum(avg((d) => d.waterMl, days))} ml; antrenman ${days.reduce((a, d) => a + d.workouts, 0)}, kardiyo ${days.reduce((a, d) => a + d.cardioMin, 0)} dk. ` +
    `En çok aşılan gün ${dn(over[0].d.day)} (${over[0].diff > 0 ? '+' : ''}${over[0].diff} kcal), en çok eksik kalan ${dn(over.at(-1)!.d.day)} (${over.at(-1)!.diff} kcal).`
}

async function exerciseLookup(userId: string, q: string): Promise<string> {
  const found = await searchExercises(userId, { q, limit: 5 })
  for (const x of found) {
    const p = await exerciseProgress(userId, x.id)
    if (!p || !p.series.length) continue
    const last = p.series.slice(-8).map((s) => `${s.day}: e1RM ${fmtNum(s.e1rm, 1)} kg`).join(', ')
    return `${p.exercise.nameTr ?? p.exercise.nameEn}: son seanslar (tahmini 1 tekrar maks.) ${last}; en iyi ${fmtNum(p.best, 1)} kg${p.level ? `, kuvvet seviyesi ${p.level.level}` : ''}${p.plateau.plateau ? `; ${p.plateau.weeks} haftadır plato (en iyi ${fmtNum(p.plateau.best, 1)}, son ${fmtNum(p.plateau.recentBest, 1)} kg)` : ''}.`
  }
  return found.length ? `"${q}" için kayıtlı antrenman yok (${found[0].nameTr ?? found[0].nameEn} kütüphanede var).` : `"${q}" adlı hareket bulunamadı.`
}

async function foodLookup(userId: string, q: string): Promise<string> {
  const hits = await searchFoods(userId, q, 5)
  if (!hits.length) return `"${q}" için besin bulunamadı.`
  return `"${q}" araması (100 g başına): ` + hits.map((h) => `${h.name}${h.sub ? ` [${h.sub}]` : ''} ${Math.round(h.kcal)} kcal, P ${fmtNum(h.protein, 1)}, K ${fmtNum(h.carb, 1)}, Y ${fmtNum(h.fat, 1)}`).join(' | ')
}

/** Model isteklerini (en çok 4) çalıştırır; sonuçlar koçun ikinci çağrısında "ARAÇ SONUÇLARI" olarak verilir. */
export async function runLookups(userId: string, list: Lookup[]): Promise<string[]> {
  const today = dayString()
  const out: string[] = []
  for (const l of list.slice(0, 4)) {
    try {
      if (l.kind === 'gun') { const d = isDay(l.date) && l.date <= today ? l.date : today; out.push(await dayLookup(userId, d)) }
      else if (l.kind === 'donem') {
        const to = isDay(l.to) && l.to <= today ? l.to : today
        const from = isDay(l.from) && l.from <= to ? l.from : addDays(to, -6)
        out.push(await rangeLookup(userId, from, to))
      } else if (l.kind === 'hareket' && l.query?.trim()) out.push(await exerciseLookup(userId, l.query.trim().slice(0, 60)))
      else if (l.kind === 'besin' && l.query?.trim()) out.push(await foodLookup(userId, l.query.trim().slice(0, 60)))
    } catch (e) { out.push(`${l.kind}: veri alınamadı (${e instanceof Error ? e.message.slice(0, 80) : 'hata'})`) }
  }
  return out
}
