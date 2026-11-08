'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { setAdvanced } from '@/lib/ui-mode'
import { getUser, requireUser } from '@/lib/auth'
import { TEXT_COOKIE, THEME_COOKIE, parseTextSize, parseTheme } from '@/lib/theme'

/** Tema tercihi cihaz başına çerezde saklanır (sunucu ilk çizimde doğru temayı basar). */
export async function setTextSizeAction(v: string): Promise<{ ok: true }> {
  await requireUser()
  const t = parseTextSize(v)
  const jar = await cookies()
  if (t === 'normal') jar.delete(TEXT_COOKIE)
  else jar.set(TEXT_COOKIE, t, { path: '/', maxAge: 60 * 60 * 24 * 400, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' && !process.env.DGFIT_TEST_HOOKS })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function setThemeAction(v: string): Promise<{ ok: true }> {
  await requireUser()
  const t = parseTheme(v)
  const jar = await cookies()
  if (t === 'auto') jar.delete(THEME_COOKIE)
  else jar.set(THEME_COOKIE, t, { path: '/', maxAge: 60 * 60 * 24 * 400, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' && !process.env.DGFIT_TEST_HOOKS })
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Sade / Gelişmiş mod (sadeleştirme 2026-11-06). */
export async function setAdvancedAction(on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await requireUser()
  if (typeof on !== 'boolean') return { ok: false, error: 'Geçersiz' }
  await setAdvanced(u.id, on)
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Faz 8: yağ oranını kaydet (doğrudan ya da ölçülerden) ve aktif hedefin makrolarını yağsız kütleye göre yenile. */
export async function saveBodyFatAction(i: { pct?: number | null; neck?: number | null; waist?: number | null; hips?: number | null }): Promise<{ ok: boolean; bf?: number; error?: string }> {
  const u = await getUser()
  if (!u) return { ok: false, error: 'Oturum yok' }
  const { saveBodyFat } = await import('@/lib/body-fat-data')
  const r = await saveBodyFat(u.id, i)
  revalidatePath('/profil/vucut'); revalidatePath('/'); revalidatePath('/yemek'); revalidatePath('/fit')
  return r
}

/** P-7: akıllı öğün hatırlatmalarını aç/kapat. */
export async function setMealRemindersAction(on: boolean): Promise<{ ok: true }> {
  const u = await requireUser()
  const { db, schema } = await import('@/lib/db')
  await db.insert(schema.coachPrefs).values({ userId: u.id, mealReminders: !!on }).onConflictDoUpdate({ target: schema.coachPrefs.userId, set: { mealReminders: !!on, updatedAt: new Date() } })
  return { ok: true }
}

/** Y1: günün bittiği saat (gün sınırı). Seçenekler DAY_START_OPTIONS; geçmiş kayıtlar yer değiştirmez. */
export async function setDayStartAction(min: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await requireUser()
  const { DAY_START_OPTIONS } = await import('@/lib/time')
  if (!DAY_START_OPTIONS.some((o) => o.min === min)) return { ok: false, error: 'Geçersiz seçim' }
  const { db, schema } = await import('@/lib/db')
  const { eq } = await import('drizzle-orm')
  await db.update(schema.profiles).set({ dayStartMin: min, updatedAt: new Date() }).where(eq(schema.profiles.userId, u.id))
  revalidatePath('/', 'layout')
  return { ok: true }
}
