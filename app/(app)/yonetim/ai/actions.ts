'use server'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { ensureProviders, sealKey } from '@/lib/ai/engine'

type R = { ok: true } | { ok: false; error: string }
async function admin() { const u = await getUser(); if (!u || !isAdmin(u.username)) throw new Error('Yetki yok'); return u }
const Id = z.enum(['claude', 'openai'])

const ProvIn = z.object({
  id: Id, enabled: z.boolean(), priority: z.number().int().min(0).max(9), model: z.string().trim().min(3).max(80).regex(/^[a-z0-9.\-_:]+$/i, 'Model adı yalnızca harf, rakam, nokta, tire'),
  dailyTokenLimit: z.number().int().min(0).max(1e9), monthlyTokenLimit: z.number().int().min(0).max(1e10),
  key: z.string().trim().max(300).optional(), removeKey: z.boolean().optional(),
})
export async function saveProviderAction(input: z.input<typeof ProvIn>): Promise<R> {
  try { await admin() } catch { return { ok: false, error: 'Yetki yok' } }
  const p = ProvIn.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Geçersiz' }
  await ensureProviders()
  const { id, key, removeKey, ...rest } = p.data
  const set: Partial<typeof schema.aiProviders.$inferInsert> = { ...rest, updatedAt: new Date() }
  if (key) {
    if (key.length < 20 || /\s/.test(key)) return { ok: false, error: 'Anahtar geçersiz görünüyor' }
    try { Object.assign(set, sealKey(id, key), { cooldownUntil: null, lastError: null }) } catch (e) { return { ok: false, error: (e as Error).message } }
  } else if (removeKey) Object.assign(set, { keyIv: null, keyTag: null, keyData: null, keyLast4: null })
  await db.update(schema.aiProviders).set(set).where(eq(schema.aiProviders.id, id))
  revalidatePath('/yonetim/ai')
  return { ok: true }
}

export async function resetCooldownAction(id: string): Promise<R> {
  try { await admin() } catch { return { ok: false, error: 'Yetki yok' } }
  if (!Id.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  await db.update(schema.aiProviders).set({ cooldownUntil: null, lastError: null }).where(eq(schema.aiProviders.id, id))
  revalidatePath('/yonetim/ai')
  return { ok: true }
}

export async function saveAiSettingsAction(userDaily: number): Promise<R> {
  try { await admin() } catch { return { ok: false, error: 'Yetki yok' } }
  if (!Number.isInteger(userDaily) || userDaily < 0 || userDaily > 1000) return { ok: false, error: 'Günlük hak 0–1000' }
  await db.insert(schema.appConfig).values({ key: 'ai', value: { userDaily } }).onConflictDoUpdate({ target: schema.appConfig.key, set: { value: { userDaily } } })
  revalidatePath('/yonetim/ai')
  return { ok: true }
}
