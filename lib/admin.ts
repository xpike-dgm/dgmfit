import 'server-only'
import { notFound } from 'next/navigation'
import { requireUser } from './auth'

/** Yönetici: sunucu ayarı DGFIT_ADMINS (virgülle kullanıcı adları; sonda "*" önek eşleşmesi, yalnızca test için). */
export function isAdmin(username: string): boolean {
  const list = (process.env.DGFIT_ADMINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return list.some((a) => (a.endsWith('*') ? process.env.DGFIT_TEST_HOOKS === '1' && username.startsWith(a.slice(0, -1)) : a === username))
}

/** Yönetici değilse sayfa yokmuş gibi 404 (varlığı sızdırılmaz). */
export async function requireAdmin() {
  const u = await requireUser()
  if (!isAdmin(u.username)) notFound()
  return u
}
