import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { addDays, dayString } from '@/lib/time'
import { activeGoal, closeDay } from '@/lib/fit-data'

/**
 * Yalnızca DGFIT_TEST_HOOKS=1 ile çalışan test kancası (canlıda 404).
 * Planı `days` gün geriye alır, geçmiş günlere tartı (günde `kgPerDay` azalan) ve plan kadar hızlı kalori yazar,
 * dün için `yesterdayExtra` kcal fazla ekler ve geçmiş günleri sırayla kapatır (gece zamanlayıcısının yaptığı gibi).
 */
export async function POST(req: Request) {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const { days = 20, kgPerDay = 0.08, yesterdayExtra = 0 } = (await req.json().catch(() => ({}))) as { days?: number; kgPerDay?: number; yesterdayExtra?: number }
  const goal = await activeGoal(u.id)
  if (!goal) return NextResponse.json({ error: 'plan yok' }, { status: 400 })
  const today = dayString()
  const start = addDays(today, -days)
  await db.update(schema.goals).set({ startDate: start }).where(eq(schema.goals.id, goal.id))
  await db.delete(schema.weightLogs).where(and(eq(schema.weightLogs.userId, u.id)))
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i)
    await db.insert(schema.weightLogs).values({ userId: u.id, loggedAt: new Date(`${d}T07:00:00+03:00`), kg: Math.round((goal.startWeightKg - i * kgPerDay) * 10) / 10, source: 'manual' })
    const kcal = goal.dailyKcal + (d === addDays(today, -1) ? yesterdayExtra : 0)
    await db.insert(schema.mealItems).values({ userId: u.id, day: d, meal: 'lunch', name: 'Test günü', grams: 0, kcal, protein: goal.proteinG, carb: goal.carbG, fat: goal.fatG, source: 'quick' })
  }
  const closed: unknown[] = []
  for (let i = 0; i < days; i++) closed.push(await closeDay(u.id, addDays(start, i)))
  return NextResponse.json({ ok: true, start, closed: closed.filter(Boolean).length, dailyKcal: goal.dailyKcal })
}
