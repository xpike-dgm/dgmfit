'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
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
