import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { proofMedia } from '@/lib/social2-data'

/** PR kanıt fotoğrafı: yalnızca yönetici (moderasyon kuyruğu). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getUser()
  if (!u || !isAdmin(u.username)) return new NextResponse(null, { status: 404 })
  const { id } = await ctx.params
  const n = Number(id)
  if (!Number.isInteger(n)) return new NextResponse(null, { status: 404 })
  const m = await proofMedia(n)
  if (!m) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(m.data), { headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
