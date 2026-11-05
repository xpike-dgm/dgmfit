import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { readMedia } from '@/lib/media'

/** Geri bildirim ekran görüntüsü: yalnızca gönderen ve yönetici. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getUser()
  const { id } = await ctx.params
  if (!u || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 })
  const [f] = await db.select({ userId: schema.feedback.userId, mediaId: schema.feedback.mediaId }).from(schema.feedback).where(eq(schema.feedback.id, id)).limit(1)
  if (!f?.mediaId || (f.userId !== u.id && !u.admin)) return new NextResponse(null, { status: 404 })
  const m = await readMedia(f.userId, f.mediaId)
  if (!m) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(m.data), { headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
