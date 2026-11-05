'use server'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { FEEDBACK_AREAS, FEEDBACK_KINDS, type FeedbackKind } from '@/lib/access'
import { createFeedback, feedbackToday, notifyAdmins } from '@/lib/admin-data'

export async function sendFeedbackAction(i: { kind: string; area: string | null; body: string; mediaId: string | null; device: { ua?: string; screen?: string; theme?: string } }): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await requireUser()
  if (!(i.kind in FEEDBACK_KINDS)) return { ok: false, error: 'Bir tür seç' }
  const body = String(i.body ?? '').trim()
  if (body.length < 10) return { ok: false, error: 'Biraz daha ayrıntı yaz (en az 10 karakter)' }
  if (body.length > 2000) return { ok: false, error: 'En fazla 2000 karakter' }
  if ((await feedbackToday(u.id)) >= 10) return { ok: false, error: 'Bugün çok fazla geri bildirim gönderdin; yarın tekrar dene' }
  const area = i.area && (FEEDBACK_AREAS as readonly string[]).includes(i.area) ? i.area : null
  let mediaId: string | null = null
  if (i.mediaId && /^[0-9a-f-]{36}$/i.test(i.mediaId)) {
    const [m] = await db.select({ id: schema.mediaBlobs.id }).from(schema.mediaBlobs).where(and(eq(schema.mediaBlobs.id, i.mediaId), eq(schema.mediaBlobs.userId, u.id), eq(schema.mediaBlobs.kind, 'feedback'))).limit(1)
    mediaId = m?.id ?? null
  }
  const d = i.device ?? {}
  const device = { ua: String(d.ua ?? '').slice(0, 300), screen: String(d.screen ?? '').slice(0, 30), theme: String(d.theme ?? '').slice(0, 10) }
  await createFeedback(u.id, { kind: i.kind as FeedbackKind, area, body, mediaId, device })
  await notifyAdmins({ title: `Yeni geri bildirim · ${FEEDBACK_KINDS[i.kind as FeedbackKind].label}`, body: `@${u.username}: ${body.slice(0, 100)}`, url: '/yonetim/geri-bildirim', tag: 'admin-feedback' })
  revalidatePath('/profil/geri-bildirim')
  return { ok: true }
}
