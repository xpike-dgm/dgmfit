import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { fmtNum } from '@/lib/calc'
import { Menu, TopBar } from '@/components/ui'
import FoodWaterToggle from './FoodWaterToggle'
import { waterSettingsData } from './data'

export const metadata: Metadata = { title: 'Su ayarları' }
const STYLE: Record<string, string> = { ring: 'Halka', bottle: 'Şişe', wave: 'Dalga' }

export default async function Page() {
  const u = await requireUser()
  const { settings, form } = await waterSettingsData(u.id)
  const special = form.goal.weekday.filter((x) => x).length
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/su" title="Su ayarları" sub="Her satır kendi sayfasını açar" />
      <Menu items={[
        { href: '/su/ayarlar/hedef', label: 'Günlük hedef ve haftanın günleri', value: `${fmtNum(form.goal.baseMl)} ml${special ? ` · ${special} özel gün` : ''}` },
        { href: '/su/ayarlar/kaplar', label: 'Kaplar', value: `${form.containers.length} kap` },
        { href: '/su/ayarlar/butonlar', label: 'Hızlı butonlar ve yudum', value: `${form.buttons.length} buton · yudum ${form.sip.ml} ml` },
        { href: '/su/ayarlar/hatirlatma', label: 'Hatırlatmalar ve sessiz saatler', value: settings?.remindersEnabled ? 'Açık' : 'Kapalı' },
        { href: '/su/ayarlar/gorunum', label: 'Görünüm ve geri bildirim', value: STYLE[form.progressStyle] ?? form.progressStyle },
      ]} />
      <FoodWaterToggle on={settings?.foodWater ?? false} />
    </div>
  )
}
