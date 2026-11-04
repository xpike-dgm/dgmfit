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
  revalidatePath('/')
  return {}
}
