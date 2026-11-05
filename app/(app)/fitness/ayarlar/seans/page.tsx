import { requireUser } from '@/lib/auth'
import { ensureGym } from '@/lib/fitness-data'
import { TopBar } from '@/components/ui'
import GymForm from '../GymForm'

export const metadata = { title: 'Seans süresi · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const g = await ensureGym(u.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/ayarlar" title="Seans süresi" sub="Programın bir günü bu süreye sığar" />
      <GymForm part="session" initial={{ barKg: g.barKg, increment: g.increment, plates: g.plates, equipment: g.equipment, sessionMinutes: g.sessionMinutes }} />
    </div>
  )
}
