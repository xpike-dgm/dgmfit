import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { AiError, runTask } from '@/lib/ai/engine'
import { labelPer100 } from '@/lib/ai/schemas'
import { sniff } from '@/lib/media'

const MAX = 4 * 1024 * 1024

/** Besin değeri tablosu fotoğrafı → okunan değerler (100 g'a çevrilmiş). Kaydetmez; özel besin formunu doldurur. */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!rateLimit('ai:' + u.id, 20, 60_000)) return NextResponse.json({ error: 'Çok hızlı; biraz bekle' }, { status: 429 })
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fotoğraf yok' }, { status: 400 })
    const data = Buffer.from(await file.arrayBuffer())
    const mime = sniff(data)
    if (!mime || data.length > MAX) return NextResponse.json({ error: 'Yalnızca JPEG, PNG ya da WebP (en çok 4 MB)' }, { status: 400 })
    const r = await runTask(u.id, 'label', { text: 'Bu besin değeri tablosunu oku.', image: { mime, data } })
    return NextResponse.json({ provider: r.provider, label: r.result, per100: labelPer100(r.result) })
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message, reason: e.reason }, { status: e.reason === 'kota' ? 429 : 503 })
    console.error('[dgfit] AI etiket', e)
    return NextResponse.json({ error: 'AI isteği işlenemedi' }, { status: 500 })
  }
}
