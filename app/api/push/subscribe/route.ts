import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { ensureWaterSetup } from '@/lib/water-data'
import { eq } from 'drizzle-orm'

const Body = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) })

export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const p = Body.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'geçersiz abonelik' }, { status: 400 })
  const { endpoint, keys } = p.data
  await ensureWaterSetup(u.id)
  await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get('user-agent')?.slice(0, 300) })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: u.id, p256dh: keys.p256dh, auth: keys.auth, failures: 0 } })
  await db.update(schema.waterSettings).set({ remindersEnabled: true, updatedAt: new Date() }).where(eq(schema.waterSettings.userId, u.id))
  return NextResponse.json({ ok: true })
}
