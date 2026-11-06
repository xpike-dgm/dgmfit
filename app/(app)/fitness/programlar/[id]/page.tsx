import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getProgram } from '@/lib/fitness-data'
import Link from 'next/link'
import { TopBar, hdrBtn } from '@/components/ui'
import ProgramEditor from './ProgramEditor'
import { isAdvanced } from '@/lib/ui-mode'

export const metadata = { title: 'Program · DgFit' }

export default async function ProgramPage(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const p = await getProgram(u.id, id)
  if (!p) notFound()
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/programlar" title="Program" sub={p.name} right={<Link href={`/sosyal/yeni?tur=program&ref=${p.id}`} className={hdrBtn}>Paylaş</Link>} />
      <ProgramEditor adv={await isAdvanced(u.id)} program={{
        id: p.id, name: p.name, active: p.active, notes: p.notes, nextDayIdx: p.nextDayIdx, periodization: p.periodization, deloadEvery: p.deloadEvery, startDay: p.startDay,
        days: p.days.map((d) => ({ id: d.id, name: d.name, focus: d.focus ?? '', exercises: d.exercises.map((e) => ({ id: e.id, exerciseId: e.exerciseId, name: e.name, kind: e.kind, sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds, setType: e.setType, scheme: e.scheme, schemeState: e.schemeState, thumb: e.thumb, images: e.images, superset: e.superset, note: e.note })) })),
      }} />
    </div>
  )
}
