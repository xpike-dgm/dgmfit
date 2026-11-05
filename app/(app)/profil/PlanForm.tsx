'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ACTIVITY, GOALS, HARD_MAX_WEEKLY_KG, computePlan, fmtNum, type Activity, type GoalType, type Sex } from '@/lib/calc'
import { btn } from '@/components/ui'
import { replanAction } from './plan-actions'

type Base = { sex: Sex; age: number; nowKg: number; heightCm: number; activity: Activity; goal: GoalType; targetWeightKg: number; daysLeft: number }

/** Hesap sayfası: boy + aktivite. Hedef sayfası: tür + hedef kilo + süre. İkisi de planı bugünden yeniden kurar (önizlemeli). */
export default function PlanForm({ base, mode }: { base: Base; mode: 'body' | 'goal' }) {
  const [v, setV] = useState({ heightCm: String(base.heightCm), activity: base.activity, goal: base.goal, target: String(base.targetWeightKg).replace('.', ','), days: String(base.daysLeft) })
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const num = (s: string) => Number(s.replace(',', '.'))
  const input = { heightCm: num(v.heightCm), activity: v.activity, goal: v.goal, targetWeightKg: v.goal === 'recomp' ? base.nowKg : num(v.target), days: Math.round(num(v.days)) }
  const plan = useMemo(() => {
    if (!(input.heightCm >= 120 && input.heightCm <= 230) || !(input.targetWeightKg >= 30) || !(input.days >= 7)) return null
    return computePlan({ sex: base.sex, age: base.age, heightCm: input.heightCm, weightKg: base.nowKg, activity: input.activity, goal: input.goal, targetWeightKg: input.targetWeightKg, days: input.goal === 'recomp' ? 90 : input.days })
  }, [input.heightCm, input.activity, input.goal, input.targetWeightKg, input.days, base])
  const field = 'h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal'
  return (
    <form className="card p-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await replanAction(input); setMsg(r.ok ? { ok: true, t: 'Planın güncellendi.' } : { ok: false, t: r.error }); if (r.ok) router.refresh() }) }}>
      {mode === 'body' ? (
        <>
          <label htmlFor="pf-h" className="flex flex-col gap-1.5 text-sm font-semibold">Boy (cm)<input id="pf-h" inputMode="numeric" value={v.heightCm} onChange={(e) => setV({ ...v, heightCm: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={field + ' num'} /></label>
          <label htmlFor="pf-a" className="flex flex-col gap-1.5 text-sm font-semibold">Günlük hareketin (antrenman hariç)
            <select id="pf-a" value={v.activity} onChange={(e) => setV({ ...v, activity: e.target.value as Activity })} className={field}>
              {(Object.keys(ACTIVITY) as Activity[]).map((k) => <option key={k} value={k}>{ACTIVITY[k].label} — {ACTIVITY[k].hint}</option>)}
            </select>
          </label>
        </>
      ) : (
        <>
          <label htmlFor="pf-g" className="flex flex-col gap-1.5 text-sm font-semibold">Hedef
            <select id="pf-g" value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value as GoalType })} className={field}>
              {(Object.keys(GOALS) as GoalType[]).map((k) => <option key={k} value={k}>{GOALS[k].label}</option>)}
            </select>
          </label>
          {v.goal !== 'recomp' ? (
            <div className="grid grid-cols-2 gap-2">
              <label htmlFor="pf-t" className="flex flex-col gap-1.5 text-sm font-semibold">Hedef kilo (kg)<input id="pf-t" inputMode="decimal" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) })} className={field + ' num'} /></label>
              <label htmlFor="pf-d" className="flex flex-col gap-1.5 text-sm font-semibold">Süre (gün)<input id="pf-d" inputMode="numeric" value={v.days} onChange={(e) => setV({ ...v, days: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={field + ' num'} /></label>
            </div>
          ) : null}
          <p className="text-[12px] text-mute">Güncel trend kilon {fmtNum(base.nowKg, 1)} kg; yeni plan bugünden başlar. Haftada {fmtNum(HARD_MAX_WEEKLY_KG, 1)} kg'dan hızlı değişim planlanamaz.</p>
        </>
      )}
      {plan ? (
        <div className={`rounded-2xl px-3.5 py-3 flex flex-col gap-1.5 text-[13px] ${!plan.allowed ? 'bg-danger-bg border border-danger-line' : plan.safe ? 'bg-surface-2' : 'bg-warn-bg border border-warn-line'}`} data-testid="plan-preview">
          <div className="flex justify-between"><span className="text-mute">Günlük kalori</span><b className="num">{fmtNum(plan.dailyKcal)} kcal</b></div>
          {input.goal !== 'recomp' ? <div className="flex justify-between"><span className="text-mute">Haftalık değişim</span><b className="num">{fmtNum(plan.weeklyKg, 2)} kg</b></div> : null}
          <div className="flex justify-between"><span className="text-mute">Protein · karb · yağ</span><b className="num">{plan.proteinG} · {plan.carbG} · {plan.fatG} g</b></div>
          {plan.warnings.map((w) => <p key={w} className={plan.allowed ? 'text-warn' : 'text-danger'}>{w}</p>)}
        </div>
      ) : null}
      <button type="submit" className={btn.primary} disabled={pending || !plan || (!plan.allowed && input.goal !== 'recomp')}>{pending ? 'Kaydediliyor…' : 'Planı güncelle'}</button>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-good' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}
