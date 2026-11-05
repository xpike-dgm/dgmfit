import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { ITEMS } from '@/lib/social'
import { Menu, TopBar } from '@/components/ui'
import { socialSettingsData } from './data'

export const metadata: Metadata = { title: 'Sosyal ayarlar · DgFit' }
const VIS: Record<string, string> = { public: 'Herkese açık', friends: 'Yalnızca arkadaşlar', private: 'Gizli' }

export default async function Page() {
  const u = await requireUser()
  const { props } = await socialSettingsData(u)
  const open = ITEMS.filter((it) => props.initial.items[it] !== 'none').length
  const notifOff = props.notifyKinds.filter(([k]) => props.initial.notify[k] === false).length
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back={`/u/${u.username}`} title="Sosyal profil ve gizlilik" sub="Varsayılan olarak her şey özel" />
      <Menu items={[
        { href: '/sosyal/ayarlar/profil', label: 'Profil bilgileri', value: 'Fotoğraf, biyografi, salon' },
        { href: '/sosyal/ayarlar/gizlilik', label: 'Gizlilik', value: VIS[props.initial.visibility] ?? props.initial.visibility },
        { href: '/sosyal/ayarlar/gorunenler', label: 'Profilde görünenler', value: `${open} / ${ITEMS.length} açık` },
        { href: '/sosyal/ayarlar/bildirimler', label: 'Sosyal bildirimler', value: notifOff ? `${notifOff} kapalı` : 'Hepsi açık' },
        { href: '/sosyal/ayarlar/davet', label: 'Davet linki ve QR' },
      ]} />
      <p className="text-[12px] text-mute px-1">Kilo ve vücut verileri hiçbir ayarda gösterilmez.</p>
    </div>
  )
}
