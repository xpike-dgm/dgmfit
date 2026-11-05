'use server'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'
import { db, schema } from '@/lib/db'
import { isAdmin } from '@/lib/admin-list'
import { isStatus, type FeedbackStatus } from '@/lib/access'
import * as A from '@/lib/admin-data'

type R = { ok: true; msg?: string } | { ok: false; error: string }
const done = (msg?: string): R => { revalidatePath('/yonetim', 'layout'); return { ok: true, msg } }

/** Hedef kullanıcı: var mı, yönetici mi (yöneticiye yıkıcı işlem yapılmaz). */
async function target(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [u] = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(eq(schema.users.id, id)).limit(1)
  return u ? { ...u, admin: isAdmin(u.username) } : null
}

export async function setStatusAction(id: string, status: string): Promise<R> {
  const me = await requireAdmin()
  const t = await target(id)
  if (!t || !isStatus(status)) return { ok: false, error: 'Kullanıcı bulunamadı' }
  if (t.admin && status !== 'approved') return { ok: false, error: 'Yönetici hesabı engellenemez' }
  await A.setUserStatus(id, status, me.username)
  return done({ approved: 'Onaylandı', suspended: 'Askıya alındı, oturumları kapatıldı', rejected: 'Reddedildi', pending: 'Beklemeye alındı' }[status])
}

export async function approveAllAction(): Promise<R> {
  const me = await requireAdmin()
  const n = await A.approveAllPending(me.username)
  return done(`${n} hesap onaylandı`)
}

export async function setAiDailyAction(id: string, value: string): Promise<R> {
  await requireAdmin()
  if (!(await target(id))) return { ok: false, error: 'Kullanıcı bulunamadı' }
  const v = value.trim()
  const n = v === '' ? null : Number(v)
  if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1000)) return { ok: false, error: 'Günlük hak 0–1000 arasında tam sayı olmalı (boş = genel ayar)' }
  await A.setAiDaily(id, n)
  return done(n === null ? 'Genel ayara döndü' : n === 0 ? 'AI bu hesapta kapatıldı' : `Günlük hak ${n} oldu`)
}

export async function setNoteAction(id: string, note: string): Promise<R> {
  await requireAdmin()
  if (!(await target(id))) return { ok: false, error: 'Kullanıcı bulunamadı' }
  await A.setAdminNote(id, note)
  return done('Not kaydedildi')
}

export async function endSessionsAction(id: string): Promise<R> {
  const me = await requireAdmin()
  const t = await target(id)
  if (!t) return { ok: false, error: 'Kullanıcı bulunamadı' }
  if (t.id === me.id) return { ok: false, error: 'Kendi oturumunu buradan kapatamazsın' }
  const n = await A.endSessions(id)
  return done(`${n} oturum kapatıldı`)
}

export async function resetDataAction(id: string, confirm: string, social: boolean): Promise<R> {
  const me = await requireAdmin()
  const t = await target(id)
  if (!t) return { ok: false, error: 'Kullanıcı bulunamadı' }
  if (t.admin && t.id !== me.id) return { ok: false, error: 'Başka bir yöneticinin verisi sıfırlanamaz' }
  if (confirm.trim().toLowerCase() !== t.username.toLowerCase()) return { ok: false, error: 'Onay için kullanıcı adını aynen yaz' }
  try { await A.resetUserData(id, { social }) } catch (e) { return { ok: false, error: 'Sıfırlanamadı: ' + (e as Error).message.slice(0, 160) } }
  return done('Veriler sıfırlandı; kullanıcı kurulumdan yeniden başlayacak')
}

export async function deleteUserAction(id: string, confirm: string): Promise<R> {
  const me = await requireAdmin()
  const t = await target(id)
  if (!t) return { ok: false, error: 'Kullanıcı bulunamadı' }
  if (t.admin || t.id === me.id) return { ok: false, error: 'Yönetici hesabı silinemez' }
  if (confirm.trim().toLowerCase() !== t.username.toLowerCase()) return { ok: false, error: 'Onay için kullanıcı adını aynen yaz' }
  const r = await A.deleteUser(id)
  if (!r.ok) return r
  return done('Hesap silindi')
}

export async function feedbackStatusAction(id: string, status: string): Promise<R> {
  await requireAdmin()
  if (!['new', 'seen', 'done'].includes(status) || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Geçersiz' }
  await A.setFeedbackStatus(id, status as FeedbackStatus)
  return done(status === 'done' ? 'Çözüldü olarak işaretlendi' : 'Güncellendi')
}

export async function feedbackReplyAction(id: string, reply: string, close: boolean): Promise<R> {
  await requireAdmin()
  const t = reply.trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Geçersiz' }
  if (t.length < 2 || t.length > 2000) return { ok: false, error: 'Yanıt 2–2000 karakter olmalı' }
  await A.replyFeedback(id, t, close)
  return done('Yanıt gönderildi; kullanıcı geri bildirim sayfasında görecek')
}

export async function createInviteAction(label: string, maxUses: string, days: string): Promise<R & { code?: string }> {
  const me = await requireAdmin()
  const m = maxUses.trim() === '' ? null : Number(maxUses)
  const d = days.trim() === '' ? null : Number(days)
  if (m !== null && (!Number.isInteger(m) || m < 1 || m > 10000)) return { ok: false, error: 'Kullanım sayısı 1–10000 (boş = sınırsız)' }
  if (d !== null && (!Number.isInteger(d) || d < 1 || d > 365)) return { ok: false, error: 'Geçerlilik 1–365 gün (boş = süresiz)' }
  const code = await A.createInvite(me.username, { label, maxUses: m, days: d })
  revalidatePath('/yonetim', 'layout')
  return { ok: true, msg: 'Davet kodu oluşturuldu', code }
}

export async function inviteToggleAction(code: string, disabled: boolean): Promise<R> {
  await requireAdmin()
  await A.setInviteDisabled(code, disabled)
  return done(disabled ? 'Kod kapatıldı' : 'Kod açıldı')
}

export async function inviteDeleteAction(code: string): Promise<R> {
  await requireAdmin()
  await A.deleteInvite(code)
  return done('Kod silindi')
}
