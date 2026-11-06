import { requireUser } from '@/lib/auth'
import { ensureGym, getExercise } from '@/lib/fitness-data'
import { exerciseMedia, plateImages } from '@/lib/licensed'
import PrAttempt from './PrAttempt'

export const metadata = { title: 'Rekor denemesi · DgFit' }

export default async function Page(props: { searchParams: Promise<{ ex?: string }> }) {
  const u = await requireUser()
  const id = Number((await props.searchParams).ex)
  const gym = await ensureGym(u.id)
  let ex: { id: number; name: string; kind: string; thumb: string | null; best: number | null; e1rm: number | null } | null = null
  if (Number.isInteger(id) && id > 0) {
    const x = await getExercise(u.id, id)
    if (x) ex = { id: x.id, name: x.nameTr, kind: x.kind, thumb: exerciseMedia(x.licensed).thumb, best: x.records?.kg || null, e1rm: x.records?.e1rm ? Math.round(x.records.e1rm * 10) / 10 : null }
  }
  return <PrAttempt ex={ex} gym={{ barKg: gym.barKg, plates: gym.plates, increment: gym.increment }} images={plateImages()} />
}
