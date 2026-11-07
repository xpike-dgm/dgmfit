import { requireUser } from '@/lib/auth'
import { Menu, TopBar } from '@/components/ui'
import { coachPrefs } from '@/lib/coach-data'
import MealReminderToggle from './MealReminderToggle'

export const metadata = { title: 'Bildirimler' }

export default async function Page() {
  const u = await requireUser()
  const prefs = await coachPrefs(u.id)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil" title="Bildirimler" sub="Her modülün bildirimi kendi sayfasında" />
      <Menu items={[
        { href: '/su/ayarlar/hatirlatma', label: 'Su hatırlatmaları', value: 'Akıllı, sessiz saatli' },
        { href: '/sosyal/ayarlar/bildirimler', label: 'Sosyal bildirimler', value: 'Tepki, yorum, mesaj…' },
        { href: '/koc?ayarlar=1', label: 'Koç ve haftalık rapor', value: 'İçgörü, Pazar raporu' },
        { href: '/fitness/ayarlar', label: 'Antrenman', value: 'Dinlenme bildirimi canlı modda' },
      ]} />
      <MealReminderToggle on={prefs.mealReminders} />
    </div>
  )
}
