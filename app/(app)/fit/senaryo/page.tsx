import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { loadFit } from '../load'
import { calorieFloor } from '@/lib/calc'
import { Scenario } from '../Planner'

export const metadata = { title: 'Senaryo simülatörü' }

export default async function Page() {
  const user = await requireUser()
  const { goal, today, checkin, sex, type, trendNow } = await loadFit(user.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fit" title="Senaryo simülatörü" sub="Bir alışkanlığı değiştirsen hedefe ne zaman varırsın?" />
      {type !== 'recomp' ? <Scenario goal={type} currentKg={trendNow} targetKg={goal.targetWeightKg} tdee={checkin?.tdee.tdee ?? goal.tdee} tdeeMeasured={!!checkin?.tdee.tdee} dailyKcal={goal.dailyKcal} floor={calorieFloor(sex)} today={today} endDate={goal.endDate} /> : null}
    </div>
  )
}
