import 'server-only'
// Faz 8: yağ oranı kaydı ve aktif hedefin makrolarının yağsız kütleye göre yenilenmesi.
import { and, eq } from 'drizzle-orm'
import { db, schema } from './db'
import { dayString } from './time'
import { ageFromBirthDate, type GoalType, type Sex } from './calc'
import { macroPlan, navyBodyFat } from './body-comp'
import { activeGoal, weightSeries } from './fit-data'
import { publish } from './events'

export async function saveBodyFat(userId: string, i: { pct?: number | null; neck?: number | null; waist?: number | null; hips?: number | null }): Promise<{ ok: boolean; bf?: number; error?: string }> {
  const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  if (!p) return { ok: false, error: 'Profil yok' }
  const sex = p.sex as Sex
  let bf: number | null = null
  let source: 'user' | 'navy' = 'user'
  if (i.pct !== undefined && i.pct !== null) {
    if (!(i.pct >= 3 && i.pct <= 60)) return { ok: false, error: 'Yağ oranı %3–60 arasında olmalı' }
    bf = Math.round(i.pct * 10) / 10
  } else {
    if (!i.neck || !i.waist || i.neck < 20 || i.neck > 70 || i.waist < 40 || i.waist > 200) return { ok: false, error: 'Boyun 20–70 cm, bel 40–200 cm aralığında olmalı' }
    if (sex === 'female' && (!i.hips || i.hips < 50 || i.hips > 220)) return { ok: false, error: 'Kalça 50–220 cm aralığında olmalı' }
    bf = navyBodyFat(sex, p.heightCm, i.neck, i.waist, i.hips ?? null)
    if (bf === null) return { ok: false, error: 'Ölçüler tutarsız görünüyor (bel boyundan büyük olmalı)' }
    source = 'navy'
    // ölçüler tabloya da yazılır (Fit → Ölçüler geçmişinde görünsün)
    await db.insert(schema.bodyMeasurements).values({ userId, day: dayString(), neckCm: i.neck, waistCm: i.waist, hipsCm: i.hips ?? null, bodyFatPct: bf })
  }
  await db.update(schema.profiles).set({ bodyFatPct: bf, bodyFatSource: source, updatedAt: new Date() }).where(eq(schema.profiles.userId, userId))
  const goal = await activeGoal(userId)
  if (goal) {
    const today = dayString()
    const trend = (await weightSeries(userId, today, today)).at(-1)?.trend ?? p.weightKg
    const mp = macroPlan({ goal: goal.type as GoalType, sex, age: ageFromBirthDate(p.birthDate), weightKg: trend, heightCm: p.heightCm, bfPct: bf, kcal: goal.dailyKcal })
    await db.update(schema.goals).set({ proteinG: mp.protein, carbG: mp.carb, fatG: mp.fat }).where(and(eq(schema.goals.id, goal.id)))
  }
  await publish(userId, 'bodyfat.updated', { bf, source })
  return { ok: true, bf }
}
