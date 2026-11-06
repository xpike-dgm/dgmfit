'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { setAdvanced } from '@/lib/ui-mode'
import { requireUser } from '@/lib/auth'
import { THEME_COOKIE, parseTheme } from '@/lib/theme'

/** Tema tercihi cihaz başına çerezde saklanır (sunucu ilk çizimde doğru temayı basar). */
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
