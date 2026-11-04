import { requireUser } from '@/lib/auth'
import { liveSession } from '@/lib/fitness-data'
import LiveWorkout from './LiveWorkout'

export const metadata = { title: 'Antrenman · DgFit' }

export default async function LivePage(props: { searchParams: Promise<{ gun?: string; hareket?: string }> }) {
  const u = await requireUser()
  const { gun, hareket } = await props.searchParams
  const dayId = gun && /^[0-9a-f-]{36}$/.test(gun) ? gun : null
  const extra = hareket && /^\d+$/.test(hareket) ? [Number(hareket)] : []
  const s = await liveSession(u.id, dayId, extra)
  return <LiveWorkout name={s.name} programDayId={dayId && s.programDayId ? dayId : null} bodyKg={s.bodyKg} deficitKcal={s.deficitKcal} gym={s.gym} exercises={s.exercises} week={s.week} fuel={s.fuel} />
}
