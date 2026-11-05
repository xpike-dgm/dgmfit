import { requireUser } from '@/lib/auth'
import { ensureGym } from '@/lib/fitness-data'
import { TopBar } from '@/components/ui'
import GymForm from '../GymForm'

export const metadata = { title: 'Bar ve plakalar · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const g = await ensureGym(u.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/ayarlar" title="Bar ve plakalar" sub="Plaka hesabı bunlara göre yapılır" />
      <GymForm part="plates" initial={{ barKg: g.barKg, increment: g.increment, plates: g.plates, equipment: g.equipment, sessionMinutes: g.sessionMinutes }} />
    </div>
  )
}
