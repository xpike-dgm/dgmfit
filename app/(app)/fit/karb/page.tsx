import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { loadFit } from '../load'
import { CarbCycle } from '../Planner'

export const metadata = { title: 'Karb döngüsü' }

export default async function Page() {
  const user = await requireUser()
  const { goal, cc } = await loadFit(user.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fit" title="Karb döngüsü" sub="Antrenman günü daha çok, dinlenme günü daha az karbonhidrat" />
      <CarbCycle enabled={cc.enabled} weekdays={cc.weekdays} shiftG={cc.shiftG} base={{ kcal: goal.dailyKcal, protein: goal.proteinG, carb: goal.carbG, fat: goal.fatG }} />
    </div>
  )
}
