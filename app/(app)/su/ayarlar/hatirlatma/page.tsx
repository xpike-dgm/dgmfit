import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import PushSettings from '../PushSettings'
import { waterSettingsData } from '../data'

export const metadata: Metadata = { title: 'Su hatırlatmaları' }

export default async function Page() {
  const u = await requireUser()
  const { settings } = await waterSettingsData(u.id)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/su/ayarlar" title="Hatırlatmalar" sub="Akıllı bildirimler ve sessiz saatler" />
      <PushSettings enabled={settings?.remindersEnabled ?? false} summaryEnabled={settings?.summaryEnabled ?? true} maxPerDay={settings?.maxPerDay ?? 8} quiet={settings?.quiet ?? []} />
    </div>
  )
}
