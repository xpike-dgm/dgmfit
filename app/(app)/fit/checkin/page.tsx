import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { loadFit } from '../load'
import { fmtNum } from '@/lib/calc'
import { addDays, shortDate } from '@/lib/time'
import { Eyebrow } from '@/components/ui'
import { Pulse } from '@/components/icons'
import { CheckinApply } from '../FitClient'

export const metadata = { title: 'Haftalık check-in' }

export default async function Page() {
  const user = await requireUser()
  const { goal, checkin } = await loadFit(user.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fit" title="Haftalık check-in" sub="Plan, ölçülen harcamana göre ayarlanır" />
      <section aria-label="Haftalık check-in" className="card p-5 flex flex-col gap-3" data-testid="checkin">
        <div className="flex items-center gap-2"><Pulse size={18} className="text-violet" /><Eyebrow>Haftalık check-in</Eyebrow></div>
        {checkin?.proposal ? (
          <>
            <p className="text-[15px] text-ink-2 leading-relaxed">{checkin.proposal.reason}</p>
            {checkin.proposal.delta !== 0 ? (
              <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
                <span className="num text-lg font-bold">{fmtNum(goal.dailyKcal)} → {fmtNum(checkin.proposal.kcal)} kcal</span>
                {checkin.due ? <CheckinApply /> : <span className="text-[12px] text-mute">Sonraki: {shortDate(addDays(checkin.lastCheckin, 7))}</span>}
              </div>
            ) : null}
            <span className="text-[12px] text-mute">Ölçülen harcama {checkin.tdee.spanDays} günlük trend ve {checkin.tdee.loggedDays} tam kayıtlı günden hesaplandı (güven: {checkin.tdee.confidence}).</span>
          </>
        ) : (
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Gerçek harcamanı ölçmek için en az 14 günlük tartı trendi ve 10 tam kayıtlı gün gerekiyor (şu an {checkin?.tdee.spanDays ?? 0} gün, {checkin?.tdee.loggedDays ?? 0} tam gün).
            Sonra her hafta planın kanıta göre en fazla 150 kcal ayarlanır.
          </p>
        )}
      </section>
    </div>
  )
}
