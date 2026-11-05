import { requireUser } from '@/lib/auth'
import { ensureGym } from '@/lib/fitness-data'
import { TopBar } from '@/components/ui'
import GymForm from '../GymForm'

export const metadata = { title: 'Ekipman · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const g = await ensureGym(u.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/ayarlar" title="Ekipman" sub="Programlar yalnızca bunlarla kurulur" />
      <GymForm part="equipment" initial={{ barKg: g.barKg, increment: g.increment, plates: g.plates, equipment: g.equipment, sessionMinutes: g.sessionMinutes }} />
    </div>
  )
}
