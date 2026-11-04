import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString, diffDays } from './time'
import { ageFromBirthDate } from './calc'
import { dailyTotals, goalHistory } from './water-data'
import { dayMacros } from './food-data'
import { computeStreak, goalForDay } from './water'
import { dayTargets, type DayTarget } from './fit-data'
import { kcalAdherence } from './fit'

export interface TodayData {
  day: string
  profile: typeof schema.profiles.$inferSelect
  age: number
  goal: typeof schema.goals.$inferSelect | null
  dayIndex: number
  totalDays: number
  target: { kcal: number; protein: number; carb: number; fat: number; water: number; adjustment: number; base: number; reasons: DayTarget['reasons']; closed: boolean }
  eaten: { kcal: number; protein: number; carb: number; fat: number }
  burned: number
  waterMl: number
  streak: number
  weight: { latest: number; trend: number; start: number; target: number; progress: number; planned: number; history: { day: string; kg: number }[] }
  week: { day: string; label: string; num: string; frac: number; water: number; kcal: number; today: boolean; future: boolean }[]
}

const DAY_LABELS = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

/** Günlük ağırlık dalgalanmasını yumuşatan üssel hareketli ortalama. */
export function trendWeight(points: { day: string; kg: number }[], alpha = 0.15): number {
  if (!points.length) return 0
  let t = points[0].kg
  for (let i = 1; i < points.length; i++) t = t + alpha * (points[i].kg - t)
  return Math.round(t * 10) / 10
}

export async function getToday(userId: string, day: string = dayString()): Promise<TodayData | null> {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  if (!profile) return null
  const [goal] = await db.select().from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.active, true)))
    .orderBy(desc(schema.goals.createdAt)).limit(1)

  const logs = await db.select({ loggedAt: schema.weightLogs.loggedAt, kg: schema.weightLogs.kg })
    .from(schema.weightLogs)
    .where(and(eq(schema.weightLogs.userId, userId), isNull(schema.weightLogs.deletedAt)))
    .orderBy(schema.weightLogs.loggedAt)
  // gün başına son tartı
  const byDay = new Map<string, number>()
  for (const l of logs) byDay.set(dayString(l.loggedAt), l.kg)
  const history = [...byDay.entries()].map(([d, kg]) => ({ day: d, kg }))
  const latest = history.at(-1)?.kg ?? profile.weightKg
  const trend = trendWeight(history) || latest

  const start = goal?.startWeightKg ?? profile.weightKg
  const tgt = goal?.targetWeightKg ?? profile.targetWeightKg
  const totalDays = goal ? diffDays(goal.startDate, goal.endDate) + 1 : 1
  const dayIndex = goal ? Math.min(totalDays, diffDays(goal.startDate, day) + 1) : 1
  const span = tgt - start
  const progress = span === 0 ? 1 : Math.max(0, Math.min(1, (trend - start) / span))
  const planned = span === 0 ? 1 : Math.max(0, Math.min(1, (dayIndex - 1) / Math.max(1, totalDays - 1)))

  // Bu haftanın günleri (Pazartesi başlangıçlı)
  const dow0 = new Date(day + 'T12:00:00Z').getUTCDay()
  const monday0 = addDays(day, -((dow0 + 6) % 7))
  const weekTargets = await dayTargets(userId, monday0, addDays(monday0, 6), goal ?? null)
  const dt = weekTargets.find((t) => t.day === day)!
  const target = { kcal: dt.kcal, protein: dt.protein, carb: dt.carb, fat: dt.fat, water: goal?.waterMl ?? 2500, adjustment: dt.adjustment, base: dt.base, reasons: dt.reasons, closed: dt.closed }
  const eatenRows = await db.execute<{ day: string; kcal: number }>(sql`select day::text as day, coalesce(sum(kcal),0)::float as kcal from meal_items where user_id = ${userId} and day >= ${monday0} and day <= ${day} and deleted_at is null group by day`)
  const eatenBy = new Map(eatenRows.map((r) => [String(r.day), Number(r.kcal)]))

  // Bu haftanın günleri (Pazartesi başlangıçlı)
  const dow = new Date(day + 'T12:00:00Z').getUTCDay()
  const monday = addDays(day, -((dow + 6) % 7))

  // Su: hedef tarihçesi + gün toplamları (hafta halkaları ve seri için son 120 gün)
  const wHistory = await goalHistory(userId)
  const sFrom = addDays(day, -119)
  const wTotals = await dailyTotals(userId, sFrom < monday ? sFrom : monday, day)
  const wGoal = (d: string) => (wHistory.length ? goalForDay(wHistory, d) : goal?.waterMl ?? 2500)
  const waterMl = wTotals.get(day)?.total ?? 0
  target.water = wGoal(day)
  const sDays = Array.from({ length: 120 }, (_, i) => { const d = addDays(sFrom, i); return { day: d, total: wTotals.get(d)?.total ?? 0, goal: wGoal(d) } })
  const fa = sDays.findIndex((d) => d.total > 0)
  const streak = fa >= 0 ? computeStreak(sDays.slice(fa)).current : 0
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    return {
      day: d,
      label: DAY_LABELS[new Date(d + 'T12:00:00Z').getUTCDay()],
      num: String(Number(d.slice(8, 10))),
      ...(() => {
        if (d > day) return { frac: 0, water: 0, kcal: 0 }
        const water = Math.min(1, (wTotals.get(d)?.total ?? 0) / Math.max(1, wGoal(d)))
        const kcal = kcalAdherence(eatenBy.get(d) ?? 0, weekTargets[i].kcal)
        return { frac: Math.round(((water + kcal) / 2) * 100) / 100, water, kcal } // su + kalori uyumu ortalaması
      })(),
      today: d === day,
      future: d > day,
    }
  })

  return {
    day, profile, age: ageFromBirthDate(profile.birthDate), goal: goal ?? null, dayIndex, totalDays, target,
    eaten: await dayMacros(userId, day), burned: 0, waterMl, streak,
    weight: { latest, trend, start, target: tgt, progress, planned, history },
    week,
  }
}
