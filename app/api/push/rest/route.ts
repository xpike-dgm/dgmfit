import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getUser, rateLimit } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { cancelRest, scheduleRest } from '@/lib/rest-push'

/** Dinlenme bitişinde push planla (en çok 15 dk). Aboneliği yoksa { scheduled: false }. */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!rateLimit('rest:' + u.id, 240, 3600_000)) return NextResponse.json({ scheduled: false })
  const b = (await req.json().catch(() => ({}))) as { seconds?: number; next?: string; url?: string }
  const sec = Number(b.seconds)
  if (!(sec >= 5 && sec <= 900)) return NextResponse.json({ error: 'süre 5–900 sn' }, { status: 400 })
  const [sub] = await db.select({ id: schema.pushSubscriptions.id }).from(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, u.id))).limit(1)
  if (!sub) return NextResponse.json({ scheduled: false })
  const url = typeof b.url === 'string' && /^\/fitness\/antrenman(\?[\w=&%-]*)?$/.test(b.url) ? b.url : '/fitness/antrenman'
  scheduleRest(u.id, sec, typeof b.next === 'string' ? b.next.slice(0, 60) : null, url)
  return NextResponse.json({ scheduled: true })
}

export async function DELETE() {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  cancelRest(u.id)
  return NextResponse.json({ ok: true })
}
