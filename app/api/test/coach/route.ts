import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { addDays, dayString } from '@/lib/time'

/**
 * Yalnızca DGFIT_TEST_HOOKS=1 ile çalışan test kancası (canlıda 404).
 * `reset`: kullanıcının içgörü/rapor satırlarını siler. `meals`: bugünden `offset` gün önceye `items` adet, toplam `kcal` öğün kalemi yazar.
 */
export async function POST(req: Request) {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const { reset = false, meals = [] } = (await req.json().catch(() => ({}))) as { reset?: boolean; meals?: { offset: number; kcal: number; items: number }[] }
  if (reset) await db.delete(schema.aiInsights).where(and(eq(schema.aiInsights.userId, u.id)))
  const today = dayString()
  for (const m of meals.slice(0, 30)) {
    const day = addDays(today, -Math.max(1, Math.min(60, Math.round(m.offset))))
    const n = Math.max(1, Math.min(10, m.items))
    for (let i = 0; i < n; i++) await db.insert(schema.mealItems).values({ userId: u.id, day, meal: 'lunch', name: 'Test kalemi', grams: 0, kcal: Math.round(m.kcal / n), protein: 10, carb: 10, fat: 5, source: 'quick' })
  }
  return NextResponse.json({ ok: true })
}
