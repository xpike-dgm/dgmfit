'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { fmtNum } from '@/lib/calc'
import { MEAL_LABEL, type MealId } from '@/lib/food'
import { createMenuAction, logPlanMealAction } from './actions'

type Item = { id: number; name: string; grams: number; kcal: number | null; matched: boolean; logged: boolean }
type Day = { day: string; label: string; target: number; proteinTarget: number; kcal: number; protein: number; meals: { meal: string; items: Item[] }[] }
type Plan = { id: string; provider: string | null; prepSteps: string[]; days: Day[] }
const BUDGET = [['ekonomik', 'Ekonomik'], ['orta', 'Orta'], ['serbest', 'Serbest']] as const

export default function PlanClient({ plan, aiOn, today }: { plan: Plan | null; aiOn: boolean; today: string }) {
  const [form, setForm] = useState(!plan)
  const [v, setV] = useState({ days: 7 as 1 | 7, start: 'today' as 'today' | 'tomorrow', budget: 'orta', prep: false, note: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [sel, setSel] = useState(() => Math.max(0, plan?.days.findIndex((d) => d.day === today) ?? 0))
  const [pending, start] = useTransition()
  const router = useRouter()
  const create = async () => {
    setBusy(true); setErr(null)
    const r = await createMenuAction(v).catch(() => ({ ok: false as const, error: 'Bağlantı yok' }))
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setForm(false); setSel(0); router.push(`/yemek/plan?id=${r.id}`); router.refresh()
  }
  const d = plan?.days[sel]
  return (
    <div className="flex flex-col gap-3" data-testid="plan">
      {form ? (
        <form className="card p-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void create() }} data-testid="menu-form">
          <p className="text-[13px] text-mute">Fit'teki günlük kalori ve protein hedeflerine, beslenme tercihine ve alerjilerine göre menü hazırlanır. Kaloriler besin veritabanından hesaplanır ve gramlar her günün hedefine ölçeklenir.</p>
          <Seg label="Süre" value={String(v.days)} opts={[['1', '1 gün'], ['7', '7 gün']]} onChange={(x) => setV({ ...v, days: Number(x) as 1 | 7 })} />
          <Seg label="Başlangıç" value={v.start} opts={[['today', 'Bugün'], ['tomorrow', 'Yarın']]} onChange={(x) => setV({ ...v, start: x as 'today' })} />
          <Seg label="Bütçe" value={v.budget} opts={BUDGET} onChange={(x) => setV({ ...v, budget: x })} />
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">Toplu hazırlık planı (meal prep)
            <input type="checkbox" checked={v.prep} onChange={(e) => setV({ ...v, prep: e.target.checked })} className="w-5 h-5 accent-[var(--color-lime)]" /></label>
          <label htmlFor="menu-note" className="flex flex-col gap-1 text-[13px] font-semibold">Not (isteğe bağlı)
            <input id="menu-note" maxLength={200} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Ör: balık sevmem, öğle yemekleri pratik olsun" className="h-12 rounded-xl bg-surface-2 border border-line px-3 font-normal" /></label>
          {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
          <button type="submit" className={btn.primary} disabled={!aiOn || busy}>{busy ? 'Menü hazırlanıyor…' : 'Menü oluştur'}</button>
          {!aiOn ? <p className="text-[12px] text-orange">AI şu an kullanılamıyor.</p> : null}
          {plan ? <button type="button" className={btn.ghost} onClick={() => setForm(false)}>Vazgeç</button> : null}
        </form>
      ) : null}

      {plan && d && !form ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Günler">
            {plan.days.map((x, i) => <button key={x.day} role="tab" aria-selected={i === sel} onClick={() => setSel(i)} className={`h-10 px-3 rounded-full text-[13px] font-bold shrink-0 ${i === sel ? 'bg-lime text-lime-ink' : 'bg-surface-2'}`}>{x.day === today ? 'Bugün' : x.label}</button>)}
          </div>
          <section className="card p-4 flex items-center justify-between" data-testid="plan-day-total">
            <span className="text-[13px] text-mute">Günün toplamı</span>
            <span className="text-[14px]"><b className="num">{fmtNum(d.kcal)}</b> / {fmtNum(d.target)} kcal · protein <b className="num">{fmtNum(d.protein)}</b> / {fmtNum(d.proteinTarget)} g</span>
          </section>
          {Math.abs(d.kcal - d.target) > d.target * 0.1 ? <p className="text-[13px] text-orange px-1" data-testid="plan-off">Bu gün hedefin {fmtNum(Math.abs(d.kcal - d.target))} kcal {d.kcal < d.target ? 'altında' : 'üstünde'} (porsiyonlar en fazla %35 ölçeklenir). {d.kcal < d.target ? 'Bir ara öğün ekleyebilir ya da yeni menü oluşturabilirsin.' : 'Porsiyonları küçültebilirsin.'}</p> : null}
          {d.meals.map((m) => {
            const kcal = Math.round(m.items.reduce((a, x) => a + (x.kcal ?? 0), 0))
            const canLog = d.day <= today && m.items.some((x) => x.matched && !x.logged)
            const allLogged = m.items.filter((x) => x.matched).every((x) => x.logged)
            return (
              <section key={m.meal} className="card px-4 py-3 flex flex-col gap-1" data-testid="plan-meal" data-meal={m.meal}>
                <div className="flex items-center justify-between"><span className="font-bold">{MEAL_LABEL[m.meal as MealId]}</span><span className="num text-[13px] text-mute">{fmtNum(kcal)} kcal</span></div>
                <ul className="flex flex-col">{m.items.map((x) => (
                  <li key={x.id} className="flex justify-between gap-2 py-1 text-[14px] border-b border-line last:border-0">
                    <span className={x.matched ? '' : 'text-mute'}>{x.name} <span className="text-mute">· {fmtNum(x.grams)} g</span></span>
                    <span className="num">{x.kcal === null ? 'eşleşme yok' : `${fmtNum(x.kcal)} kcal`}</span>
                  </li>
                ))}</ul>
                {canLog ? <button type="button" className="self-start mt-1 h-10 px-4 rounded-full bg-lime text-lime-ink font-bold text-[13px]" disabled={pending}
                  onClick={() => start(async () => { const r = await logPlanMealAction({ planId: plan.id, day: d.day, meal: m.meal }); setMsg(r.ok ? `${MEAL_LABEL[m.meal as MealId]} günlüğe eklendi · ${fmtNum(r.kcal)} kcal` : r.error); router.refresh() })}>Günlüğe ekle</button>
                  : allLogged && d.day <= today ? <span className="text-[12px] text-lime">Günlükte</span> : null}
              </section>
            )
          })}
          {msg ? <p role="status" className="text-[13px] text-ink-2 px-1">{msg}</p> : null}
          {plan.prepSteps.length ? (
            <section className="card p-4 flex flex-col gap-2" data-testid="prep">
              <span className="font-bold">Toplu hazırlık</span>
              <ol className="list-decimal pl-5 flex flex-col gap-1 text-[14px] text-ink-2">{plan.prepSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
          ) : null}
          <p className="text-[11px] text-faint text-center">Öneri: {plan.provider === 'openai' ? 'OpenAI' : 'Claude'} · kalori ve gramlar DgFit motorundan</p>
          <button type="button" className={btn.secondary} onClick={() => setForm(true)}>Yeni menü oluştur</button>
        </>
      ) : null}
    </div>
  )
}

function Seg({ label, value, opts, onChange }: { label: string; value: string; opts: readonly (readonly [string, string])[]; onChange: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[13px] font-semibold mb-1">{label}</legend>
      <div className="flex gap-2">{opts.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={`h-10 px-4 rounded-full text-[13px] font-bold ${value === k ? 'bg-lime text-lime-ink' : 'bg-surface-2'}`}>{l}</button>)}</div>
    </fieldset>
  )
}
