import { requireUser } from '@/lib/auth'
import { ensureGym } from '@/lib/fitness-data'
import { EQUIPMENT } from '@/lib/exercise-labels'
import { ALL_EQUIPMENT } from '@/lib/programs'
import { fmtNum } from '@/lib/calc'
import { Menu, TopBar } from '@/components/ui'

export const metadata = { title: 'Salon ayarları · DgFit' }

export default async function GymPage() {
  const u = await requireUser()
  const g = await ensureGym(u.id)
  const eq = g.equipment.length >= ALL_EQUIPMENT.length ? 'Tam salon' : g.equipment.slice(0, 2).map((k) => EQUIPMENT[k] ?? k).join(', ') + (g.equipment.length > 2 ? ` +${g.equipment.length - 2}` : '')
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness" title="Salon ayarları" sub="Her satır kendi sayfasını açar" />
      <Menu items={[
        { href: '/fitness/ayarlar/ekipman', label: 'Ekipman', value: eq },
        { href: '/fitness/ayarlar/plakalar', label: 'Bar ve plakalar', value: g.barKg ? `${fmtNum(g.barKg)} kg bar` : 'Bar yok' },
        { href: '/fitness/ayarlar/artis', label: 'Ağırlık artışı', value: `${fmtNum(g.increment, g.increment % 1 ? 1 : 0)} kg` },
        { href: '/fitness/ayarlar/seans', label: 'Seans süresi', value: `${g.sessionMinutes} dk` },
      ]} />
    </div>
  )
}
