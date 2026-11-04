import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { addDays, dayString } from '@/lib/time'

/**
 * Yalnızca DGFIT_TEST_HOOKS=1 ile (canlıda 404). Bir hareket için geçmişe dönük antrenmanlar yazar:
 * sessions: [{ daysAgo, kg, reps, sets }] (RIR 0). Rekor ve ilerleme ekranlarını gerçek geçmişle test etmek için.
 */
export async function POST(req: Request) {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const { key, sessions } = (await req.json()) as { key: string; sessions: { daysAgo: number; kg: number; reps: number; sets: number }[] }
  const [x] = await db.select({ id: schema.exercises.id }).from(schema.exercises).where(eq(schema.exercises.key, key)).limit(1)
  if (!x) return NextResponse.json({ error: 'hareket yok' }, { status: 400 })
  const today = dayString()
  for (const s of sessions) {
    const day = addDays(today, -s.daysAgo)
    const at = new Date(`${day}T18:00:00+03:00`)
    const start = s.daysAgo === 0 ? new Date(Date.now() - 50 * 60000) : at
    const [w] = await db.insert(schema.workouts).values({
      userId: u.id, clientId: 'seed-' + crypto.randomUUID(), name: 'Tohum', day, startedAt: start, endedAt: new Date(start.getTime() + 45 * 60000), durationSec: 2700,
      volumeKg: s.kg * s.reps * s.sets, workSets: s.sets, kcalGross: 0, kcalNet: 0,
    }).returning({ id: schema.workouts.id })
    await db.insert(schema.workoutSets).values(Array.from({ length: s.sets }, (_, i) => ({ workoutId: w.id, userId: u.id, exerciseId: x.id, exIdx: 0, setIdx: i, type: 'normal', kg: s.kg, reps: s.reps, rir: 0, completedAt: new Date(start.getTime() + (i + 1) * 180000) })))
  }
  return NextResponse.json({ ok: true, exerciseId: x.id })
}
