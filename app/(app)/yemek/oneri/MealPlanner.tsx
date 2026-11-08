'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MEALS, type MealId } from '@/lib/food'
import { fmtNum } from '@/lib/calc'
import type { MealSuggestion } from '@/lib/meal-builder-data'
import { addMealPlanAction, suggestMealsAction } from '../actions'

const FIELDS: { k: 'protein' | 'carb' | 'fat' | 'kcal'; l: string; u: string }[] = [
  { k: 'protein', l: 'Protein', u: 'g' }, { k: 'carb', l: 'Karb.', u: 'g' }, { k: 'fat', l: 'Yağ', u: 'g' }, { k: 'kcal', l: 'Kalori', u: 'kcal' },
]

/** Y2: kalan değerler + "en çok" sınırları → öneri kartları; "Öğüne ekle" tüm kalemleri günlüğe yazar. */
export default function MealPlanner({ initial, meal: meal0 }: { initial: MealSuggestion; meal: MealId }) {
  const [s, setS] = useState(initial)
  const [lim, setLim] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map((f) => [f.k, initial.limits[f.k] != null ? String(initial.limits[f.k]) : ''])))
  const [meal, setMeal] = useState<MealId>(meal0)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const recalc = () => start(async () => {
    const n = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null)
    setS(await suggestMealsAction({ protein: n(lim.protein), carb: n(lim.carb), fat: n(lim.fat), kcal: n(lim.kcal) })); setMsg(null)
  })
  const add = (i: number) => start(async () => {
    const r = await addMealPlanAction(meal, s.meals[i].items.map((it) => ({ foodId: it.id, grams: it.grams })))
    if (!r.ok) { setMsg(r.error); return }
    setMsg(`${r.n} kalem ${MEALS.find((m) => m.id === meal)?.label.toLocaleLowerCase('tr')} öğününe eklendi`); router.refresh()
    setS(await suggestMealsAction({}))
  })
  const rem = s.remaining
  return (
    <>
      <section className="card rounded-[22px] p-4 flex flex-col gap-3" aria-label="Kalan">
        <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-mute">Bugün kalan</span>
        <div className="grid grid-cols-4 gap-2 text-center" data-testid="mp-remaining">
          {FIELDS.map((f) => (
            <span key={f.k} className="flex flex-col"><b className="num text-[17px]">{fmtNum(Math.max(0, rem[f.k]))}</b><span className="text-[11px] text-mute">{f.l}{f.u === 'g' ? ' g' : ''}</span></span>
          ))}
        </div>
        <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-mute mt-1">En çok (isteğe bağlı)</span>
        <div className="grid grid-cols-4 gap-2">
          {FIELDS.map((f) => (
            <label key={f.k} className="flex flex-col gap-1 text-[11px] text-mute">{f.l}
              <input inputMode="numeric" value={lim[f.k]} onChange={(e) => setLim({ ...lim, [f.k]: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })} placeholder="—"
                className="h-11 rounded-[12px] bg-surface-2 border border-line px-2 num text-center text-[15px] text-ink outline-none focus:border-acc" data-testid={`mp-lim-${f.k}`} />
            </label>
          ))}
        </div>
        <button type="button" onClick={recalc} disabled={pending} className="h-11 rounded-full bg-surface-2 border border-line-2 font-bold text-[14px]" data-testid="mp-recalc">{pending ? 'Hesaplanıyor…' : 'Yeniden öner'}</button>
      </section>

      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Öğün">
        {MEALS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={meal === m.id} onClick={() => setMeal(m.id)} className="h-10 rounded-full text-[13px] font-bold border bg-surface-2 text-ink-2 border-line aria-checked:bg-acc aria-checked:text-acc-ink aria-checked:border-acc">{m.label.replace(' yemeği', '')}</button>)}
      </div>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}

      {s.meals.length ? s.meals.map((m, i) => (
        <section key={i} className="card rounded-[22px] p-4 flex flex-col gap-2.5" data-testid="mp-meal">
          <ul className="flex flex-col gap-1.5">
            {m.items.map((it) => (
              <li key={it.id} className="flex items-baseline justify-between gap-3"><span className="text-[15px] font-bold min-w-0 truncate">{it.name}</span><span className="num text-[14px] text-ink-2 shrink-0">{fmtNum(it.grams)} g</span></li>
            ))}
          </ul>
          <div className="grid grid-cols-4 gap-1 text-center rounded-[14px] bg-surface-2 py-2" data-testid="mp-totals">
            {FIELDS.map((f) => {
              const v = m.totals[f.k], cap = s.limits[f.k]
              const over = cap != null && v > cap
              return <span key={f.k} className="flex flex-col"><b className={`num text-[14px] ${over ? 'text-orange' : ''}`}>{fmtNum(v, f.k === 'kcal' ? 0 : 0)}</b><span className="text-[10.5px] text-mute">{f.l}</span></span>
            })}
          </div>
          <button type="button" onClick={() => add(i)} disabled={pending} className="h-12 rounded-full bg-acc text-acc-ink font-extrabold text-[14px] disabled:opacity-50" data-testid="mp-add">Öğüne ekle</button>
        </section>
      )) : <p className="card rounded-[22px] p-4 text-[13.5px] text-mute">{rem.kcal < 60 ? 'Bugünkü kalori bütçen doldu; öneri yok.' : 'Bu sınırlarla uygun bir kombinasyon bulunamadı. Sınırları biraz gevşetmeyi dene.'}</p>}
      <p className="text-[11.5px] text-mute px-1 leading-relaxed">Öneriler son 60 günde sık yediklerinden ve temel besinlerden kurulur. Değerler 100 g başına veritabanı değerlerinden hesaplanır.</p>
    </>
  )
}
