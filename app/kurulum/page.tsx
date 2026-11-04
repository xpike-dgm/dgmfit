import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import Wizard from './Wizard'

export const metadata: Metadata = { title: 'Profilini oluştur' }

export default async function Page() {
  const u = await getUser()
  if (!u) redirect('/giris')
  if (u.onboarded) redirect('/')
  return <Wizard username={u.username} />
}
