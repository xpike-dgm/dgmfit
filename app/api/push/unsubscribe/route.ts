import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string }
  if (body.endpoint) await db.delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, u.id), eq(schema.pushSubscriptions.endpoint, body.endpoint)))
  return NextResponse.json({ ok: true })
}
