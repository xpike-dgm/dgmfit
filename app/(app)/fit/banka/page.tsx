import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { loadFit, wd } from '../load'
import { fmtNum } from '@/lib/calc'
import { addDays, shortDate } from '@/lib/time'
import { Eyebrow } from '@/components/ui'
import { Spark } from '@/components/icons'
import { BankForm, CancelBank } from '../FitClient'

export const metadata = { title: 'Kalori bankası' }

export default async function Page() {
  const user = await requireUser()
  const { s, goal, today } = await loadFit(user.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fit" title="Kalori bankası" sub="Özel bir gün için önceden biriktir" />
      <section aria-label="Kalori bankası" className="card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2"><Spark size={18} className="text-orange" /><Eyebrow>Kalori bankası</Eyebrow></div>
        <p className="text-[13px] text-ink-2 leading-relaxed">Düğün, davet, tatil… Özel bir gün için önceki günlerden biraz biriktir, o gün rahat ye. Toplam plan değişmez.</p>
        {s.banks.map((b) => (
          <div key={b.bankId} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3" data-testid="bank-item">
            <span className="flex flex-col">
              <span className="font-bold">{shortDate(b.day)}{b.note ? ` · ${b.note}` : ''}</span>
              <span className="text-[13px] text-mute">+{fmtNum(b.extra)} kcal ekstra</span>
            </span>
            <CancelBank bankId={b.bankId} />
          </div>
        ))}
        <BankForm days={Array.from({ length: 13 }, (_, i) => addDays(today, i + 2)).filter((d) => d <= goal.endDate).map((d) => ({ day: d, label: `${wd(d)} ${shortDate(d)}` }))} />
      </section>
    </div>
  )
}
