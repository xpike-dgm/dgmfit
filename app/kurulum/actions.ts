'use server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { ageFromBirthDate, computePlan } from '@/lib/calc'
import { addDays, dayString } from '@/lib/time'
import { publish } from '@/lib/events'

const Input = z.object({
  sex: z.enum(['male', 'female']),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(250),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'gain', 'recomp']),
  targetWeightKg: z.number().min(30).max(250),
  days: z.number().int().min(7).max(1100),
  experience: z.enum(['new', 'mid', 'adv']).nullable().optional(),
  trainingDays: z.number().int().min(0).max(7).nullable().optional(),
  dietPref: z.string().max(40).nullable().optional(),
  allergies: z.array(z.string().max(40)).max(20).optional(),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
})

export type OnboardingInput = z.infer<typeof Input>

export async function completeOnboarding(raw: OnboardingInput): Promise<{ error?: string }> {
  const user = await getUser()
  if (!user) redirect('/giris')
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { error: 'Bazı bilgiler eksik veya geçersiz. Lütfen adımları kontrol et.' }
  const d = parsed.data
  const age = ageFromBirthDate(d.birthDate)
  if (age < 16) return { error: 'DgFit 16 yaş ve üzeri içindir.' }
  if (age > 100) return { error: 'Doğum tarihini kontrol et.' }
  const target = d.goal === 'recomp' ? d.weightKg : d.targetWeightKg
  const minHealthy = 18.5 * (d.heightCm / 100) ** 2
  if (d.goal === 'lose' && target < minHealthy - 0.05) return { error: 'Hedef kilo sağlıklı aralığın altında. Lütfen daha yüksek bir hedef seç.' }

  const plan = computePlan({ sex: d.sex, age, heightCm: d.heightCm, weightKg: d.weightKg, activity: d.activity, goal: d.goal, targetWeightKg: target, days: d.days })
  if (!plan.allowed && d.goal !== 'recomp') return { error: plan.warnings[0] ?? 'Bu tempo planlanamaz.' }

  const today = dayString()
  const now = new Date()
  const profile = {
    sex: d.sex, birthDate: d.birthDate, heightCm: d.heightCm, weightKg: d.weightKg, activity: d.activity, goal: d.goal,
    targetWeightKg: target, experience: d.experience ?? null, trainingDays: d.trainingDays ?? null, dietPref: d.dietPref ?? null,
    allergies: d.allergies ?? [], wakeTime: d.wakeTime ?? null, sleepTime: d.sleepTime ?? null,
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.profiles).values({ userId: user.id, ...profile, onboardedAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: schema.profiles.userId, set: { ...profile, onboardedAt: now, updatedAt: now } })
    await tx.insert(schema.profileHistory).values({ userId: user.id, effectiveFrom: today, data: { ...profile, days: d.days } })
    await tx.update(schema.goals).set({ active: false }).where(eq(schema.goals.userId, user.id))
    await tx.insert(schema.goals).values({
      userId: user.id, type: d.goal, startWeightKg: d.weightKg, targetWeightKg: target, startDate: today,
      endDate: addDays(today, plan.days - 1), tdee: plan.tdee, dailyKcal: plan.dailyKcal, proteinG: plan.proteinG,
      carbG: plan.carbG, fatG: plan.fatG, waterMl: plan.waterMl,
    })
    await tx.insert(schema.weightLogs).values({ userId: user.id, loggedAt: now, kg: d.weightKg, source: 'onboarding' })
  })
  await publish(user.id, 'profile.onboarded', { goal: d.goal, dailyKcal: plan.dailyKcal })
  await publish(user.id, 'weight.logged', { kg: d.weightKg, source: 'onboarding' })
  redirect('/')
}
