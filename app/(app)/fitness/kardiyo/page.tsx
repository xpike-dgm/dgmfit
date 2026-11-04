import { requireUser } from '@/lib/auth'
import { recentCardio } from '@/lib/fitness-data'
import { CARDIO } from '@/lib/training'
import { shortDate, dayString } from '@/lib/time'
import { Eyebrow, TopBar } from '@/components/ui'
import { CardioForm, DeleteCardio } from './CardioForm'

export const metadata = { title: 'Kardiyo · DgFit' }

export default async function CardioPage() {
  const u = await requireUser()
  const list = await recentCardio(u.id, 15)
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/fitness" title="Kardiyo" />
      <CardioForm types={Object.entries(CARDIO).map(([k, v]) => ({ id: k, label: v.label, distance: v.distance }))} today={dayString()} />
      <section className="card p-5 flex flex-col gap-1" aria-label="Son kardiyolar">
        <Eyebrow>Son kayıtlar</Eyebrow>
        {list.length ? list.map((c) => (
          <div key={c.id} className="flex items-center justify-between min-h-[52px] gap-2 border-b border-line last:border-0" data-testid="cardio-item">
            <span className="flex flex-col">
              <span className="font-semibold">{CARDIO[c.type]?.label ?? c.type} · {Math.round(c.minutes)} dk{c.distanceKm ? ` · ${String(c.distanceKm).replace('.', ',')} km` : ''}</span>
              <span className="text-[12px] text-mute">{shortDate(c.day)} · net {c.kcalNet} kcal (brüt {c.kcalGross}) · {c.method === 'acsm' ? 'hız denklemi' : c.method === 'nabız' ? 'nabız formülü' : `MET, ${c.intensity}`}</span>
            </span>
            <DeleteCardio id={c.id} />
          </div>
        )) : <p className="text-[13px] text-mute">Henüz kayıt yok.</p>}
      </section>
    </div>
  )
}
