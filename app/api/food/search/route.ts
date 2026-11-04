import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { searchFoods } from '@/lib/food-data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!rateLimit('fsearch:' + u.id, 240, 60_000)) return NextResponse.json({ results: [] })
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 80)
  return NextResponse.json({ results: await searchFoods(u.id, q) })
}
