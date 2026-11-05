import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { loadFit, REASON, groupReasons, signed, wd } from '../load'
import { fmtNum } from '@/lib/calc'
import { dayCap } from '@/lib/fit'
import { shortDate } from '@/lib/time'
import { Eyebrow } from '@/components/ui'
import { Calendar } from '@/components/icons'

export const metadata = { title: 'Önümüzdeki 7 gün' }

export default async function Page() {
  const user = await requireUser()
  const { s, goal, today } = await loadFit(user.id)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fit" title="Önümüzdeki 7 gün" sub="Dengeleme ve banka etkisiyle günlük hedefler" />
      <section aria-label="Önümüzdeki 7 gün" className="card p-5 flex flex-col gap-2" data-testid="next-days">
        <div className="flex items-center gap-2 mb-1"><Calendar size={18} className="text-mute" /><Eyebrow>Önümüzdeki 7 gün</Eyebrow></div>
        {s.targets.map((t) => (
          <div key={t.day} className="flex items-center gap-3 min-h-[44px]">
            <span className="w-14 text-sm font-semibold">{t.day === today ? 'Bugün' : wd(t.day)} <span className="text-mute font-normal num">{Number(t.day.slice(8))}</span></span>
            <div className="flex-1 flex flex-wrap gap-1">
              {t.reasons.length ? groupReasons(t.reasons).map((r) => (
                <span key={r.reason + (r.sourceDay ?? '')} className="text-[11px] px-2 h-6 rounded-full bg-surface-2 flex items-center text-ink-2">
                  {REASON[r.reason] ?? r.reason}{r.sourceDay ? ` · ${shortDate(r.sourceDay)}` : ''} <b className="num ml-1 text-ink">{signed(r.kcal)}</b>
                </span>
              )) : <span className="text-[12px] text-faint">Plan</span>}
            </div>
            <span className="num text-[17px] font-bold w-16 text-right">{fmtNum(t.kcal)}</span>
          </div>
        ))}
        <p className="text-[12px] text-mute leading-relaxed mt-1">
          Bir günün hedefi dengeleme yüzünden en fazla {fmtNum(dayCap(goal.dailyKcal))} kcal değişir ve {fmtNum(s.floor)} kcal güvenli tabanın altına inmez. Protein sabit kalır; fark karbonhidrat ve yağa dağıtılır.
        </p>
      </section>
    </div>
  )
}
