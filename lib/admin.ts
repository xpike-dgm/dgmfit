import 'server-only'
import { notFound } from 'next/navigation'
import { requireUser } from './auth'
export { isAdmin, adminList } from './admin-list'

/** Yönetici değilse sayfa yokmuş gibi 404 (varlığı sızdırılmaz). */
export async function requireAdmin() {
  const u = await requireUser()
  if (!u.admin) notFound()
  return u
}
