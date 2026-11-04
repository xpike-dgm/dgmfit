import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString, diffDays } from './time'
import { ageFromBirthDate } from './calc'

export interface TodayData {
  day: string
  profile: typeof schema.profiles.$inferSelect
  age: number
  goal: typeof schema.goals.$inferSelect | null
  dayIndex: number
  totalDays: number
  target: { kcal: number; protein: number; carb: number; fat: number; water: number; adjustment: number }
  eaten: { kcal: number; protein: number; carb: number; fat: number }
  burned: number
  waterMl: number
  weight: { latest: number; trend: number; start: number; target: number; progress: number; planned: number; history: { day: string; kg: number }[] }
  week: { day: string; label: string; num: string; frac: number; today: boolean; future: boolean }[]
}

const DAY_LABELS = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

/** Günlük ağırlık dalgalanmasını yumuşatan üssel hareketli ortalama. */
export function trendWeight(points: { day: string; kg: number }[], alpha = 0.15): number {
  if (!points.length) return 0
  let t = points[0].kg
  for (let i = 1; i < points.length; i++) t = t + alpha * (points[i].kg - t)
  return Math.round(t * 10) / 10
}

export async function getToday(userId: string): Promise<TodayData | null> {
  const day = dayString()
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

  const [dt] = await db.select().from(schema.dailyTargets)
    .where(and(eq(schema.dailyTargets.userId, userId), eq(schema.dailyTargets.day, day))).limit(1)
  const target = {
    kcal: (dt?.baseKcal ?? goal?.dailyKcal ?? 2000) + (dt?.adjustmentKcal ?? 0),
    protein: dt?.proteinG ?? goal?.proteinG ?? 120,
    carb: dt?.carbG ?? goal?.carbG ?? 200,
    fat: dt?.fatG ?? goal?.fatG ?? 65,
    water: dt?.waterMl ?? goal?.waterMl ?? 2500,
    adjustment: dt?.adjustmentKcal ?? 0,
  }

  // Bu haftanın günleri (Pazartesi başlangıçlı)
  const dow = new Date(day + 'T12:00:00Z').getUTCDay()
  const monday = addDays(day, -((dow + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    return {
      day: d,
      label: DAY_LABELS[new Date(d + 'T12:00:00Z').getUTCDay()],
      num: String(Number(d.slice(8, 10))),
      frac: 0, // yemek ve su modülleri gelince günlük tamamlama oranı
      today: d === day,
      future: d > day,
    }
  })

  return {
    day, profile, age: ageFromBirthDate(profile.birthDate), goal: goal ?? null, dayIndex, totalDays, target,
    eaten: { kcal: 0, protein: 0, carb: 0, fat: 0 }, burned: 0, waterMl: 0,
    weight: { latest, trend, start, target: tgt, progress, planned, history },
    week,
  }
}
