import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import SocialSettings from '../SocialSettings'
import { socialSettingsData } from '../data'

export const metadata: Metadata = { title: 'Davet linki ve QR · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const { props } = await socialSettingsData(u)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal/ayarlar" title="Davet linki ve QR" sub="Arkadaşlarını DgFit'e çağır" />
      <SocialSettings {...props} part="invite" />
    </div>
  )
}
