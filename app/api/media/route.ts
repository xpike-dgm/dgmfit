import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { DAILY_QUOTA_BYTES, MAX_BYTES, bytesUploadedToday, deleteMedia, mediaEnabled, saveMedia, type MediaKind } from '@/lib/media'
import { setExercisePhoto } from '@/lib/fitness-stats'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { addDays, dayString } from '@/lib/time'

/** Şifreli fotoğraf yükleme (multipart: file, kind=progress|exercise|social|avatar|feedback, day?, pose?, exerciseId?). */
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
  const kind = (['exercise', 'social', 'avatar', 'feedback', 'band', 'motive'].includes(k) ? k : 'progress') as MediaKind
  const today = dayString()
  const dayIn = String(form.get('day') ?? today)
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayIn) && dayIn <= today && dayIn >= addDays(today, -3650) ? dayIn : today
  const poseIn = String(form.get('pose') ?? '')
  const pose = ['ön', 'yan', 'arka'].includes(poseIn) ? poseIn : null
  // sahiplik, blob kaydedilmeden ÖNCE denetlenir (reddedilen istek depolama harcamasın)
  let exId = 0
  if (kind === 'exercise') {
    exId = Number(form.get('exerciseId'))
    const own = Number.isInteger(exId) ? await db.select({ id: schema.exercises.id }).from(schema.exercises).where(and(eq(schema.exercises.id, exId), eq(schema.exercises.userId, u.id), eq(schema.exercises.source, 'user'))).limit(1) : []
    if (!own.length) return NextResponse.json({ error: 'Yalnızca kendi hareketine fotoğraf eklenebilir' }, { status: 403 })
  }
  if ((await bytesUploadedToday(u.id)) + file.size > DAILY_QUOTA_BYTES) return NextResponse.json({ error: 'Günlük yükleme sınırına ulaştın (60 MB); yarın tekrar dene' }, { status: 429 })
  try {
    const id = await saveMedia(u.id, { kind, day, pose, data: Buffer.from(await file.arrayBuffer()) })
    if (kind === 'exercise' && !(await setExercisePhoto(u.id, exId, id))) {
      await deleteMedia(u.id, id)
      return NextResponse.json({ error: 'Yalnızca kendi hareketine fotoğraf eklenebilir' }, { status: 403 })
    }
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
