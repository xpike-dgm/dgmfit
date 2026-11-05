'use server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { ageFromBirthDate, computePlan, type Sex } from '@/lib/calc'
import { addDays, dayString } from '@/lib/time'
import { publish } from '@/lib/events'

const In = z.object({
  heightCm: z.number().min(120).max(230),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'gain', 'recomp']),
  targetWeightKg: z.number().min(30).max(250),
  days: z.number().int().min(7).max(1100),
})
export type ReplanInput = z.infer<typeof In>

/**
 * Profil (boy, aktivite) ya da hedef (tür, hedef kilo, süre) değişince planı bugünden yeniden kurar.
 * Başlangıç kilosu = güncel trend kilo; geçmiş günlerin hedefleri değişmez (yeni hedef satırı bugünden başlar).
 */
export async function replanAction(raw: ReplanInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await requireUser()
  const p = In.safeParse(raw)
  if (!p.success) return { ok: false, error: 'Bilgileri kontrol et.' }
  const d = p.data
  const t = await getToday(u.id)
  if (!t) return { ok: false, error: 'Önce kurulumu tamamla.' }
  const nowKg = Math.round(t.weight.trend * 10) / 10
  const target = d.goal === 'recomp' ? nowKg : d.targetWeightKg
  if (d.goal === 'lose' && target >= nowKg) return { ok: false, error: 'Kilo vermek için hedef, güncel kilondan düşük olmalı.' }
  if (d.goal === 'gain' && target <= nowKg) return { ok: false, error: 'Kilo almak için hedef, güncel kilondan yüksek olmalı.' }
  if (d.goal === 'lose' && target < 18.5 * (d.heightCm / 100) ** 2 - 0.05) return { ok: false, error: 'Hedef kilo sağlıklı aralığın altında.' }
  const plan = computePlan({ sex: t.profile.sex as Sex, age: ageFromBirthDate(t.profile.birthDate), heightCm: d.heightCm, weightKg: nowKg, activity: d.activity, goal: d.goal, targetWeightKg: target, days: d.goal === 'recomp' ? 90 : d.days })
  if (!plan.allowed && d.goal !== 'recomp') return { ok: false, error: plan.warnings[0] ?? 'Bu tempo planlanamaz.' }
  const today = dayString()
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(schema.profiles).set({ heightCm: d.heightCm, activity: d.activity, goal: d.goal, targetWeightKg: target, updatedAt: now }).where(eq(schema.profiles.userId, u.id))
    const [pr] = await tx.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).limit(1)
    await tx.insert(schema.profileHistory).values({ userId: u.id, effectiveFrom: today, data: { ...pr, days: plan.days, reason: 'replan' } })
    await tx.update(schema.goals).set({ active: false }).where(eq(schema.goals.userId, u.id))
    await tx.insert(schema.goals).values({
      userId: u.id, type: d.goal, startWeightKg: nowKg, targetWeightKg: target, startDate: today,
      endDate: addDays(today, plan.days - 1), tdee: plan.tdee, dailyKcal: plan.dailyKcal, proteinG: plan.proteinG,
      carbG: plan.carbG, fatG: plan.fatG, waterMl: plan.waterMl,
    })
  })
  await publish(u.id, 'profile.updated', { goal: d.goal, dailyKcal: plan.dailyKcal, reason: 'replan' })
  revalidatePath('/', 'layout')
  return { ok: true }
}
