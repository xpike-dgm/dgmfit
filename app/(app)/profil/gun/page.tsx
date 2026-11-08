import { requireUser } from '@/lib/auth'
import { dayStartOf } from '@/lib/day-context'
import { TopBar } from '@/components/ui'
import DayStartPicker from './DayStartPicker'

export const metadata = { title: 'Günün bitişi' }

/** Y1: kişisel gün döngüsü — günün hangi saatte bittiği (gece yarısından sonra yenenler dünün kaydına girsin). */
export default async function Page() {
  const u = await requireUser()
  return (
    <div className="px-4 flex flex-col gap-3 pb-6" data-mod="today">
      <TopBar back="/profil" title="Günün bitişi" sub="Geç yatıyorsan gece yediklerin dünün kaydına girsin" />
      <DayStartPicker current={await dayStartOf(u.id)} />
    </div>
  )
}
