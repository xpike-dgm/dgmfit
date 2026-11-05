import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { postMedia } from '@/lib/social-data'

/** Gönderi fotoğrafı: izleyici gönderiyi görebiliyorsa sahibinin anahtarıyla çözülür; göremiyorsa 404 (varlığı sızdırılmaz). */
export async function GET(_req: Request, ctx: { params: Promise<{ postId: string; idx: string }> }) {
  const u = await getUser()
  if (!u) return new NextResponse(null, { status: 401 })
  const { postId, idx } = await ctx.params
  const i = Number(idx)
  if (!/^[0-9a-f-]{36}$/.test(postId) || !Number.isInteger(i) || i < 0 || i > 3) return new NextResponse(null, { status: 404 })
  const m = await postMedia(u.id, postId, i)
  if (!m) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(m.data), { headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } })
}
