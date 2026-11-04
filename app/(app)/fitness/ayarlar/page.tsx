import { requireUser } from '@/lib/auth'
import { ensureGym } from '@/lib/fitness-data'
import { TopBar } from '@/components/ui'
import GymForm from './GymForm'

export const metadata = { title: 'Salon ayarları · DgFit' }

export default async function GymPage() {
  const u = await requireUser()
  const g = await ensureGym(u.id)
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/fitness" title="Salon ayarları" />
      <GymForm initial={{ barKg: g.barKg, increment: g.increment, plates: g.plates, equipment: g.equipment, sessionMinutes: g.sessionMinutes }} />
    </div>
  )
}
