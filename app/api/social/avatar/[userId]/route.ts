import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { avatarMedia } from '@/lib/social-data'

/** Profil fotoğrafı: temel profili görebilen izleyiciye. */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const u = await getUser()
  if (!u) return new NextResponse(null, { status: 401 })
  const { userId } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return new NextResponse(null, { status: 404 })
  const m = await avatarMedia(u.id, userId)
  if (!m) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(m.data), { headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } })
}
