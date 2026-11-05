import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { AiError, runTask } from '@/lib/ai/engine'
import { matchMeal } from '@/lib/ai/meal'
import { sniff } from '@/lib/media'

const MAX = 4 * 1024 * 1024

/** Öğün: fotoğraf (multipart "file") ya da metin (JSON {text}) → AI kalemleri → veritabanı eşleşmesi. Hiçbir şey kaydedilmez; kullanıcı onaylar. */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!rateLimit('ai:' + u.id, 20, 60_000)) return NextResponse.json({ error: 'Çok hızlı; biraz bekle' }, { status: 429 })
  try {
    let r
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      if (Number(req.headers.get('content-length') ?? 0) > MAX + 64 * 1024) return NextResponse.json({ error: 'Fotoğraf çok büyük' }, { status: 413 })
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fotoğraf yok' }, { status: 400 })
      const data = Buffer.from(await file.arrayBuffer())
      const mime = sniff(data)
      if (!mime || data.length > MAX) return NextResponse.json({ error: 'Yalnızca JPEG, PNG ya da WebP (en çok 4 MB)' }, { status: 400 })
      const hint = String(form.get('hint') ?? '').slice(0, 200)
      r = await runTask(u.id, 'meal-photo', { text: hint ? `Kullanıcının notu: ${hint}` : 'Fotoğraftaki öğünü listele.', image: { mime, data } })
    } else {
      const { text } = (await req.json().catch(() => ({}))) as { text?: string }
      const t = (text ?? '').trim()
      if (t.length < 2 || t.length > 500) return NextResponse.json({ error: 'Öğünü 2–500 karakterle yaz' }, { status: 400 })
      r = await runTask(u.id, 'meal-text', { text: t })
    }
    return NextResponse.json({ provider: r.provider, note: r.result.note, items: await matchMeal(u.id, r.result) })
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message, reason: e.reason }, { status: e.reason === 'kota' ? 429 : 503 })
    console.error('[dgfit] AI öğün', e)
    return NextResponse.json({ error: 'AI isteği işlenemedi' }, { status: 500 })
  }
}
