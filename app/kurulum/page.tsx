import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { canEnter } from '@/lib/access'
import Wizard from './Wizard'

export const metadata: Metadata = { title: 'Profilini oluştur' }

export default async function Page() {
  const u = await getSessionUser()
  if (!u) redirect('/giris')
  if (!canEnter(u.status, u.admin)) redirect('/beklemede')
  if (u.onboarded) redirect('/')
  return <Wizard username={u.username} />
}
