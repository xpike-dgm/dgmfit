import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { storyMedia } from '@/lib/social2-data'

/** 24 saatlik kart fotoğrafı: yalnızca sahibine ve arkadaşlarına, süresi dolunca 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getUser()
  if (!u) return new NextResponse(null, { status: 401 })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 })
  const m = await storyMedia(u.id, id)
  if (!m) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(m.data), { headers: { 'Content-Type': m.mime, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } })
}
