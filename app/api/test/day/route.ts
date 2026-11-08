import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { currentDayStart, dayString } from '@/lib/time'

/** Yalnızca DGFIT_TEST_HOOKS=1 ile çalışan test kancası (canlıda 404). Y1: gün sınırını keyfi değere ayarlar (POST) ve
 *  bu istekte geçerli mantıksal günü döndürür (GET) — API rotalarında da istek kapsamının çalıştığını gösterir. */
export async function GET() {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  return NextResponse.json({ day: dayString(), calendar: dayString(new Date(), 0), dayStart: currentDayStart() })
}
export async function POST(req: Request) {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const { min } = (await req.json().catch(() => ({}))) as { min?: number }
  const m = Math.min(1439, Math.max(0, Math.round(Number(min) || 0)))
  await db.update(schema.profiles).set({ dayStartMin: m }).where(eq(schema.profiles.userId, u.id))
  return NextResponse.json({ ok: true, min: m })
}
