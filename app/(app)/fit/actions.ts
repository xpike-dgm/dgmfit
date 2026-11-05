'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { addDays, dayString } from '@/lib/time'
import { applyCheckin, cancelBank, closeDay, createBank, makeException, reopenDay } from '@/lib/fit-data'
import { saveCarbCycle } from '@/lib/planner-data'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

async function uid() {
  const u = await getUser()
  if (!u) throw new Error('Oturum yok')
  return u.id
}
function refresh() { revalidatePath('/'); revalidatePath('/fit'); revalidatePath('/yemek') }

/** "Günü kapat": bugünü (ya da dünü) elle kapatır. */
export async function closeDayAction(day: string): Promise<R<{ kind: string; diff: number; leftover: number }>> {
  const userId = await uid()
  const p = Day.safeParse(day)
  const today = dayString()
  if (!p.success || p.data > today || p.data < addDays(today, -1)) return { ok: false, error: 'Yalnızca bugün ya da dün kapatılabilir' }
  const r = await closeDay(userId, p.data)
  if (!r) return { ok: false, error: 'Gün zaten kapalı ya da plan başlangıcından önce' }
  refresh()
  return { ok: true, ...r }
}

export async function reopenDayAction(day: string): Promise<R> {
  const userId = await uid()
  const p = Day.safeParse(day)
  const today = dayString()
  if (!p.success || p.data > today || p.data < addDays(today, -1)) return { ok: false, error: 'Yalnızca bugün ya da dün yeniden açılabilir' }
  if (!(await reopenDay(userId, p.data))) return { ok: false, error: 'Gün kapalı değil' }
  refresh()
  return { ok: true }
}

export async function exceptionAction(day: string): Promise<R<{ daysAdded: number }>> {
  const userId = await uid()
  const p = Day.safeParse(day)
  if (!p.success) return { ok: false, error: 'Geçersiz gün' }
  const r = await makeException(userId, p.data)
  if (!r.removed) return { ok: false, error: 'Bu günden kalan dengeleme yok' }
  refresh()
  return { ok: true, daysAdded: r.daysAdded }
}

const BankInput = z.object({ day: Day, extra: z.number().int().min(100).max(1500), note: z.string().trim().max(40).optional() })

export async function createBankAction(input: z.input<typeof BankInput>): Promise<R<{ perDay: number; days: number }>> {
  const userId = await uid()
  const p = BankInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Ekstra kalori 100–1500 arasında olmalı' }
  const r = await createBank(userId, p.data.day, p.data.extra, p.data.note || null)
  if ('error' in r) return { ok: false, error: r.error ?? 'Oluşturulamadı' }
  refresh()
  return { ok: true, perDay: r.perDay, days: r.days }
}

export async function cancelBankAction(bankId: string): Promise<R> {
  const userId = await uid()
  if (!z.string().uuid().safeParse(bankId).success) return { ok: false, error: 'Geçersiz' }
  await cancelBank(userId, bankId)
  refresh()
  return { ok: true }
}

export async function applyCheckinAction(): Promise<R<{ kcal: number; delta: number }>> {
  const userId = await uid()
  const r = await applyCheckin(userId)
  if ('error' in r) return { ok: false, error: r.error ?? 'Uygulanamadı' }
  refresh()
  return { ok: true, kcal: r.kcal, delta: r.delta }
}

const CarbIn = z.object({ enabled: z.boolean(), weekdays: z.array(z.number().int().min(0).max(6)).max(7), shiftG: z.number().int().min(10).max(100) })
export async function saveCarbCycleAction(input: z.input<typeof CarbIn>): Promise<R> {
  const p = CarbIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz ayar' }
  const weekdays = [...new Set(p.data.weekdays)].sort()
  if (p.data.enabled && (weekdays.length === 0 || weekdays.length === 7)) return { ok: false, error: '1–6 antrenman günü seç' }
  await saveCarbCycle(await uid(), { ...p.data, weekdays })
  revalidatePath('/fit'); revalidatePath('/'); revalidatePath('/yemek')
  return { ok: true }
}
