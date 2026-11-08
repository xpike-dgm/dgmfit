import 'server-only'
// Y2: öğün kurucunun veri tarafı — aday besinler (kullanıcının sık yedikleri + temel Türk mutfağı) ve kalan makrolar.
import { sql } from 'drizzle-orm'
import { db } from './db'
import { addDays, dayString } from './time'
import { getToday } from './today'
import { buildMeals, type MBFood, type MBLimits, type MBMeal, type Macros4 } from './meal-builder'

/** Kullanıcının sık yemediği durumda da öneri çıksın diye temel besinler (adın başı eşleşen ilk Türkçe kayıt). */
const BASICS = ['Yumurta', 'Tavuk göğsü', 'Pirinç pilavı', 'Bulgur pilavı', 'Yoğurt', 'Tam buğday ekmeği', 'Mercimek çorbası', 'Muz', 'Elma',
  'Yulaf ezmesi', 'Beyaz peynir', 'Ton balığı', 'Kuru fasulye', 'Makarna', 'Süzme yoğurt', 'Lor peyniri', 'Fındık', 'Ceviz', 'Patates', 'Ayran',
  'Süt', 'Hindi füme', 'Nohut', 'Kinoa']

type Row = { id: number; name: string; kcal: number; protein: number; carb: number; fat: number; portions: { label: string; g: number }[] | null; n: number }

function toMB(r: Row, pref: number): MBFood {
  const por = (r.portions ?? []).find((p) => p.label !== '100 g' && p.label !== '100 ml' && p.g > 0)?.g ?? 100
  const step = por >= 100 ? 10 : 5
  const minG = Math.max(step, Math.round((por * 0.5) / step) * step)
  const maxG = Math.min(600, Math.max(minG + step, Math.round((por * 3) / step) * step))
  return { id: Number(r.id), name: r.name, per100: { kcal: Number(r.kcal), protein: Number(r.protein), carb: Number(r.carb), fat: Number(r.fat) }, minG, maxG, stepG: step, pref }
}

export async function mealCandidates(userId: string): Promise<MBFood[]> {
  const since = addDays(dayString(), -60)
  const mine = await db.execute<Row>(sql`
    select f.id, coalesce(f.name_tr, f.name_en) as name, f.kcal, f.protein, f.carb, f.fat, f.portions, count(*)::int as n
    from meal_items m join foods f on f.id = m.food_id
    where m.user_id = ${userId} and m.deleted_at is null and m.day >= ${since} and f.deleted_at is null and f.kcal > 0
    group by f.id order by n desc limit 14`)
  const basics = await db.execute<Row>(sql`
    select distinct on (b.ord) f.id, f.name_tr as name, f.kcal, f.protein, f.carb, f.fat, f.portions, 0 as n
    from unnest(${BASICS}::text[]) with ordinality as b(name, ord)
    join foods f on f.name_tr ilike b.name || '%' and f.source in ('dgfit', 'usda') and f.deleted_at is null and f.kcal > 0
    order by b.ord, length(f.name_tr), f.id`)
  const seen = new Set<number>(), out: MBFood[] = []
  const maxN = Math.max(1, ...mine.map((r) => Number(r.n)))
  for (const r of mine) if (!seen.has(Number(r.id))) { seen.add(Number(r.id)); out.push(toMB(r, Number(r.n) / maxN)) }
  for (const r of basics) if (!seen.has(Number(r.id)) && out.length < 28) { seen.add(Number(r.id)); out.push(toMB(r, 0)) }
  return out
}

export interface MealSuggestion { remaining: Macros4; limits: MBLimits; meals: MBMeal[]; day: string }

/** Kalan makrolara (hedef + egzersiz − yenen) ve sınırlara göre öğün önerileri. */
export async function suggestMeals(userId: string, limits: MBLimits = {}, day = dayString()): Promise<MealSuggestion> {
  const [t, foods] = await Promise.all([getToday(userId, day), mealCandidates(userId)])
  const remaining: Macros4 = t
    ? { kcal: Math.round(t.target.kcal + t.burned - t.eaten.kcal), protein: Math.round(t.target.protein - t.eaten.protein), carb: Math.round(t.target.carb - t.eaten.carb), fat: Math.round(t.target.fat - t.eaten.fat) }
    : { kcal: 600, protein: 30, carb: 70, fat: 20 }
  return { remaining, limits, day, meals: buildMeals({ remaining, limits, foods }) }
}
