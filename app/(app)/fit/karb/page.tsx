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
      {goal.type === 'recomp' && (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[14px] leading-relaxed text-ink-2" data-testid="karb-recomp-note">
          Koruyup kas kazanma planında antrenman günleri zaten daha fazla, dinlenme günleri daha az kalorili (Fit planın bunu otomatik yapıyor). Karb döngüsü bu planda ayrıca uygulanmaz; seçtiğin günler kalori döngüsünde antrenman günü olarak kullanılır.
        </p>
      )}
      <CarbCycle enabled={cc.enabled} weekdays={cc.weekdays} shiftG={cc.shiftG} base={{ kcal: goal.dailyKcal, protein: goal.proteinG, carb: goal.carbG, fat: goal.fatG }} />
    </div>
  )
}
