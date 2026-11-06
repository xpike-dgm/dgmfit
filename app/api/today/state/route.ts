import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { dayState } from '@/lib/day-state'

export const dynamic = 'force-dynamic'

/** Faz 7-2: bir kayıttan sonra etkisini göstermek için günün özeti (Bugün ile aynı hesap — lib/day-state). */
export async function GET() {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const t = await getToday(u.id)
  if (!t) return NextResponse.json({ error: 'profil yok' }, { status: 404 })
  const s = dayState({ target: t.target, eaten: t.eaten, burned: t.burned, waterMl: t.waterMl, waterBonus: t.waterBonus, workoutMin: t.workout.minutes, sinceWorkoutMin: null, nowMin: 0 })
  return NextResponse.json({ kcalLeft: s.left.kcal, proteinPct: Math.round(s.pct.protein * 100), waterPct: Math.round(s.pct.water * 100), proteinLeft: s.left.protein })
}
