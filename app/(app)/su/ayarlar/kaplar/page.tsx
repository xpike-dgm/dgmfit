import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import SettingsForm from '../SettingsForm'
import { waterSettingsData } from '../data'

export const metadata: Metadata = { title: 'Kaplar' }

export default async function Page() {
  const u = await requireUser()
  const { form } = await waterSettingsData(u.id)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/su/ayarlar" title="Kaplar" sub="Şişe, bardak ve termosların" />
      <SettingsForm {...form} part="containers" />
    </div>
  )
}
