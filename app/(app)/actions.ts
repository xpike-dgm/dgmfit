'use server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { publish } from '@/lib/events'

export async function logWeight(kg: number): Promise<{ error?: string }> {
  const u = await getUser()
  if (!u) return { error: 'Oturum süren dolmuş, tekrar giriş yap.' }
  if (!(kg >= 30 && kg <= 250)) return { error: 'Geçersiz değer' }
  const v = Math.round(kg * 10) / 10
  await db.insert(schema.weightLogs).values({ userId: u.id, loggedAt: new Date(), kg: v, source: 'manual' })
  await db.update(schema.profiles).set({ weightKg: v, updatedAt: new Date() }).where(eq(schema.profiles.userId, u.id))
  await publish(u.id, 'weight.logged', { kg: v, source: 'manual' })
  revalidatePath('/'); revalidatePath('/fit')
  return {}
}

/** Faz 8: hedefe ulaşınca / hedef tarih gelince Bugün kartındaki seçim. */
export async function goalChoiceAction(choice: 'recomp' | 'extend' | 'later' | 'new'): Promise<{ ok: boolean; error?: string; redirect?: string }> {
  const u = await getUser()
  if (!u) return { ok: false, error: 'Oturum yok' }
  if (!['recomp', 'extend', 'later', 'new'].includes(choice)) return { ok: false, error: 'Geçersiz seçim' }
  const { chooseAfterGoal } = await import('@/lib/goal-phase')
  const r = await chooseAfterGoal(u.id, choice)
  revalidatePath('/'); revalidatePath('/fit'); revalidatePath('/yemek')
  return r.ok ? { ok: true, redirect: r.redirect } : { ok: false, error: r.error }
}
