import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { imageUrl, searchExercises } from '@/lib/fitness-data'

/** Hareket arama (program düzenleyici ve canlı modda hareket ekleme). */
export async function GET(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const p = new URL(req.url).searchParams
  const s = (k: string) => (p.get(k) || '').slice(0, 60) || undefined
  const rows = await searchExercises(u.id, { q: s('q'), muscle: s('kas'), equipment: s('ekipman'), pattern: s('tip'), level: s('seviye'), limit: 40 })
  return NextResponse.json({ results: rows.map((r) => ({ ...r, image: r.images[0] ? imageUrl(r.images[0]) : null })) })
}
