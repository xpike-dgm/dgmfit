import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { MAX_BYTES, mediaEnabled, saveMedia } from '@/lib/media'
import { setExercisePhoto } from '@/lib/fitness-stats'
import { addDays, dayString } from '@/lib/time'

/** Şifreli fotoğraf yükleme (multipart: file, kind=progress|exercise|social|avatar, day?, pose?, exerciseId?). */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!mediaEnabled()) return NextResponse.json({ error: 'Fotoğraf saklama sunucuda yapılandırılmamış' }, { status: 503 })
  if (!rateLimit('media:' + u.id, 30, 3600_000)) return NextResponse.json({ error: 'Çok fazla yükleme; biraz sonra dene' }, { status: 429 })
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'Fotoğraf 3 MB\'tan büyük' }, { status: 413 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!form || !(file instanceof Blob)) return NextResponse.json({ error: 'Dosya yok' }, { status: 400 })
  const k = String(form.get('kind') ?? '')
  const kind = (['exercise', 'social', 'avatar'].includes(k) ? k : 'progress') as 'progress' | 'exercise' | 'social' | 'avatar'
  const today = dayString()
  const dayIn = String(form.get('day') ?? today)
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayIn) && dayIn <= today && dayIn >= addDays(today, -3650) ? dayIn : today
  const poseIn = String(form.get('pose') ?? '')
  const pose = ['ön', 'yan', 'arka'].includes(poseIn) ? poseIn : null
  try {
    const id = await saveMedia(u.id, { kind, day, pose, data: Buffer.from(await file.arrayBuffer()) })
    if (kind === 'exercise') {
      const exId = Number(form.get('exerciseId'))
      if (!Number.isInteger(exId) || !(await setExercisePhoto(u.id, exId, id))) return NextResponse.json({ error: 'Yalnızca kendi hareketine fotoğraf eklenebilir' }, { status: 403 })
    }
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
