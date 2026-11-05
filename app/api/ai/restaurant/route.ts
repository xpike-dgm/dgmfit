import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { AiError } from '@/lib/ai/engine'
import { restaurantOptions } from '@/lib/planner-data'
import { sniff } from '@/lib/media'

const MAX = 4 * 1024 * 1024

/** Restoran modu: menü fotoğrafı (multipart "file") → yemekler → veritabanı kalorisi → kalan bütçeye göre sıralama. Hiçbir şey kaydedilmez. */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!rateLimit('ai:' + u.id, 20, 60_000)) return NextResponse.json({ error: 'Çok hızlı; biraz bekle' }, { status: 429 })
  try {
    if (Number(req.headers.get('content-length') ?? 0) > MAX + 64 * 1024) return NextResponse.json({ error: 'Fotoğraf çok büyük' }, { status: 413 })
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fotoğraf yok' }, { status: 400 })
    const data = Buffer.from(await file.arrayBuffer())
    const mime = sniff(data)
    if (!mime || data.length > MAX) return NextResponse.json({ error: 'Yalnızca JPEG, PNG ya da WebP (en çok 4 MB)' }, { status: 400 })
    return NextResponse.json(await restaurantOptions(u.id, { mime, data }))
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message, reason: e.reason }, { status: e.reason === 'kota' ? 429 : 503 })
    console.error('[dgfit] restoran', e)
    return NextResponse.json({ error: 'AI isteği işlenemedi' }, { status: 500 })
  }
}
