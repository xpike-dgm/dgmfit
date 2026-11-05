import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { GOALS, fmtNum, type GoalType } from '@/lib/calc'
import { addDays, shortDate } from '@/lib/time'
import { btn, TopBar } from '@/components/ui'

export const metadata = { title: 'Hedef ve plan' }

export default async function Page() {
  const u = await requireUser()
  const t = await getToday(u.id)
  if (!t) redirect('/kurulum')
  const g = t.goal
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil" title="Hedef ve plan" sub={g ? GOALS[g.type as GoalType]?.label : undefined} />
      {g ? (
        <>
          <section className="card p-4 flex flex-col gap-1">
            <span className="text-[13px] text-mute">Hedef</span>
            <span className="num text-[24px] font-bold">{g.type === 'recomp' ? `${fmtNum(g.startWeightKg, 1)} kg koru` : `${fmtNum(g.startWeightKg, 1)} → ${fmtNum(g.targetWeightKg, 1)} kg`}</span>
            <span className="text-[13px] text-mute">Gün {t.dayIndex} / {t.totalDays} · hedef tarih <b className="text-ink">{shortDate(addDays(g.startDate, t.totalDays - 1))}</b></span>
          </section>
          <section className="card p-4 grid grid-cols-2 gap-2" aria-label="Günlük hedeflerin">
            {([['Kalori', `${fmtNum(g.dailyKcal)} kcal`], ['Su', `${fmtNum(g.waterMl)} ml`], ['Protein', `${g.proteinG} g`], ['Karbonhidrat', `${g.carbG} g`], ['Yağ', `${g.fatG} g`], ['Harcama (TDEE)', `${fmtNum(g.tdee)} kcal`]] as const).map(([k, v]) => (
              <div key={k} className="bg-surface-2 rounded-2xl px-3.5 py-3 flex flex-col gap-0.5"><span className="text-xs text-mute">{k}</span><span className="num font-semibold">{v}</span></div>
            ))}
          </section>
        </>
      ) : null}
      <Link href="/fit" className={btn.secondary + ' h-12'}>Plan ayrıntıları ve dengeleme</Link>
    </div>
  )
}
