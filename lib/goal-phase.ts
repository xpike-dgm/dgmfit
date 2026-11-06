import 'server-only'
// Faz 8: hedef aşamaları — hedefe ulaşma / hedef tarihin gelmesi, kullanıcının seçimi ve yeni aşamanın kurulması.
import { and, eq, gte, isNull } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString } from './time'
import { ageFromBirthDate, calorieFloor, KCAL_PER_KG, type Sex } from './calc'
import { goalReached, macroPlan } from './body-comp'
import { extendEndDate, extensionRate, goalAfterReach } from './fit'
import { activeGoal, checkinData, weightSeries } from './fit-data'
import { publish } from './events'

export type GoalStatus =
  | { kind: 'reached'; trend: number; target: number; type: 'lose' | 'gain' }
  | { kind: 'ended'; trend: number; target: number; remainingKg: number; type: 'lose' | 'gain' }
  | null

/** Bugün kartı için: hedefe ulaşıldı mı (trend, son 3 gün) ya da hedef tarih geçti mi; kullanıcı henüz seçim yapmadıysa döner. */
export async function goalStatus(userId: string): Promise<GoalStatus> {
  const goal = await activeGoal(userId)
  if (!goal || goal.type === 'recomp' || goal.reachedChoice) return null
  const today = dayString()
  const series = await weightSeries(userId, addDays(today, -9), today)
  const trend = series.filter((s) => s.trend !== null).at(-1)?.trend
  if (trend === undefined || trend === null) return null
  const type = goal.type as 'lose' | 'gain'
  if (goal.reachedAt || goalReached(type, goal.targetWeightKg, series.slice(-3).map((s) => s.trend))) {
    if (!goal.reachedAt) {
      // eşzamanlı sayfa açılışlarında olay bir kez yayınlansın: yalnızca ilk yazan yayınlar
      const hit = await db.update(schema.goals).set({ reachedAt: new Date() }).where(and(eq(schema.goals.id, goal.id), isNull(schema.goals.reachedAt))).returning({ id: schema.goals.id })
      if (hit.length) await publish(userId, 'goal.reached', { goalId: goal.id, target: goal.targetWeightKg, trend })
    }
    return { kind: 'reached', trend, target: goal.targetWeightKg, type }
  }
  if (today > goal.endDate) return { kind: 'ended', trend, target: goal.targetWeightKg, remainingKg: Math.round(Math.abs(goal.targetWeightKg - trend) * 10) / 10, type }
  return null
}

/**
 * Kullanıcının seçimi:
 *  - recomp: hedef tarih aynı kalarak kilonu koru + kas kazan (yeni aşama, bakım kalorisi, yüksek protein)
 *  - extend: hedef tarihi geçti → kalan farkı planın temposuyla bitirecek yeni tarih
 *  - later: kart kapanır; plan yön koruması (lib/fit.ts checkinProposal) devam eder
 *  - new: yeni hedef sayfasına gider (kart kapanır)
 */
export async function chooseAfterGoal(userId: string, choice: 'recomp' | 'extend' | 'later' | 'new'): Promise<{ ok: true; redirect?: string } | { ok: false; error: string }> {
  const goal = await activeGoal(userId)
  if (!goal) return { ok: false, error: 'Aktif plan yok' }
  // yalnızca kart gösterilirken geçerli: tekrar gönderim / eski sekme yeni aşamayı bozmasın
  const st = await goalStatus(userId)
  if (choice !== 'new' && (!st || (choice === 'recomp' && st.kind !== 'reached') || (choice === 'extend' && st.kind !== 'ended'))) return { ok: false, error: 'Bu seçim artık geçerli değil; sayfayı yenile' }
  const today = dayString()
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  if (!profile) return { ok: false, error: 'Profil yok' }
  const series = await weightSeries(userId, addDays(today, -9), today)
  const trend = series.filter((s) => s.trend !== null).at(-1)?.trend ?? goal.targetWeightKg
  if (choice === 'later' || choice === 'new') {
    await db.update(schema.goals).set({ reachedChoice: choice }).where(eq(schema.goals.id, goal.id))
    await publish(userId, 'goal.choice', { choice, goalId: goal.id })
    return { ok: true, redirect: choice === 'new' ? '/profil/hedef' : undefined }
  }
  if (choice === 'extend') {
    const planned = Math.max(0.15, (Math.abs(goal.tdee - goal.dailyKcal) * 7) / KCAL_PER_KG)
    const ck = await checkinData(userId).catch(() => null)
    const weeklyKg = extensionRate(ck?.forecast.kgPerWeek ?? null, planned, goal.targetWeightKg - trend)
    const endDate = extendEndDate({ trendKg: trend, targetKg: goal.targetWeightKg, weeklyKg, today })
    await db.update(schema.goals).set({ endDate }).where(eq(schema.goals.id, goal.id))
    await publish(userId, 'goal.choice', { choice, goalId: goal.id, endDate })
    return { ok: true }
  }
  // recomp: yeni aşama
  const sex = profile.sex as Sex
  const ck = await checkinData(userId).catch(() => null)
  const tdee = ck?.smoothTdee ?? goal.tdee
  const keep = goalAfterReach({ endDate: goal.endDate, today, tdee, floor: calorieFloor(sex) })
  const age = ageFromBirthDate(profile.birthDate)
  const mp = macroPlan({ goal: 'recomp', sex, age, weightKg: trend, heightCm: profile.heightCm, bfPct: profile.bodyFatPct ?? null, kcal: keep.kcal })
  await db.transaction(async (tx) => {
    await tx.update(schema.goals).set({ active: false, reachedChoice: 'recomp' }).where(eq(schema.goals.id, goal.id))
    // eski planın bugünden sonraki dengeleme düzeltmeleri yeni koruma planını kesmesin (banka etkinlikleri kalır)
    await tx.update(schema.kcalAdjustments).set({ deletedAt: new Date() }).where(and(eq(schema.kcalAdjustments.userId, userId), eq(schema.kcalAdjustments.reason, 'balance'), gte(schema.kcalAdjustments.day, today), isNull(schema.kcalAdjustments.deletedAt)))
    await tx.insert(schema.goals).values({
      userId, type: 'recomp', startWeightKg: trend, targetWeightKg: trend, startDate: today, endDate: keep.endDate, tdee,
      dailyKcal: keep.kcal, proteinG: mp.protein, carbG: mp.carb, fatG: mp.fat, waterMl: goal.waterMl, phase: goal.phase + 1,
    })
    await tx.update(schema.profiles).set({ goal: 'recomp', targetWeightKg: trend, updatedAt: new Date() }).where(and(eq(schema.profiles.userId, userId)))
  })
  await publish(userId, 'goal.choice', { choice, goalId: goal.id, kcal: keep.kcal, endDate: keep.endDate })
  return { ok: true }
}
