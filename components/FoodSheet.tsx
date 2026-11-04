'use client'
import { useMemo, useState } from 'react'
import { fmtNum } from '@/lib/calc'
import { budgetImpact, macrosFor, MEALS, portionGrams, type MealId } from '@/lib/food'

export interface SheetFood {
  id: number
  name: string
  sub: string | null
  per100: Record<string, number>
  portions: { label: string; g: number }[]
  approx: boolean
  attribution: string | null
  lastGrams?: number
  lastLabel?: string | null
}

const TO_MEAL: Record<MealId, string> = { breakfast: 'Kahvaltıya ekle', lunch: 'Öğle yemeğine ekle', dinner: 'Akşam yemeğine ekle', snack: 'Ara öğüne ekle' }

/** Besin seçildiğinde porsiyon, miktar ve öğün seçimi; anlık makro ve bütçe etkisi. */
export default function FoodSheet({ food, meal: initialMeal, remaining, onAdd, pending }: {
  food: SheetFood
  meal: MealId
  remaining: number
  onAdd: (v: { grams: number; portionLabel: string; portionQty: number; meal: MealId }) => void
  pending?: boolean
}) {
  const initialIdx = Math.max(0, food.lastLabel ? food.portions.findIndex((p) => p.label === food.lastLabel) : 0)
  const [pi, setPi] = useState(initialIdx)
  const [qty, setQty] = useState(() => {
    const p = food.portions[initialIdx]
    if (!food.lastGrams || !p) return p?.label === '100 g' ? 100 : 1
    // gram modunda miktar = gram; porsiyon modunda miktar = porsiyon adedi
    return p.label === '100 g' ? Math.round(food.lastGrams) : Math.max(0.25, Math.round((food.lastGrams / p.g) * 4) / 4)
  })
  const [meal, setMeal] = useState<MealId>(initialMeal)
  const portion = food.portions[pi] ?? { label: '100 g', g: 100 }
  const isGrams = portion.label === '100 g'
  const grams = useMemo(() => (qty > 0 ? portionGrams(portion, isGrams ? qty / 100 : qty) : 0), [portion, qty, isGrams])
  const m = macrosFor(food.per100, grams)
  const impact = budgetImpact(m.kcal, remaining)
  const step = isGrams ? 10 : 0.5

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-0.5 -mt-2">
        {food.sub ? <span className="text-[13px] text-mute">{food.sub}</span> : null}
        <span className="text-xs text-mute">100 g: <b className="num text-ink-2">{fmtNum(food.per100.kcal ?? 0)} kcal</b> · P {fmtNum(food.per100.protein ?? 0, 1)} · K {fmtNum(food.per100.carb ?? 0, 1)} · Y {fmtNum(food.per100.fat ?? 0, 1)}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5" role="group" aria-label="Porsiyon">
        {food.portions.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={i === pi} onClick={() => { setPi(i); setQty(p.label === '100 g' ? 100 : 1) }}
            className={`h-10 px-3.5 rounded-full text-sm font-bold whitespace-nowrap border ${i === pi ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line'}`}>
            {p.label === '100 g' ? 'Gram' : p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button type="button" aria-label="Azalt" onClick={() => setQty((q) => Math.max(step, Math.round((q - step) * 100) / 100))} className="w-14 h-14 rounded-2xl bg-surface-2 text-2xl font-bold">−</button>
        <div className="flex flex-col items-center w-32">
          <label htmlFor="fs-qty" className="sr-only">{isGrams ? 'Gram' : 'Miktar'}</label>
          <input id="fs-qty" inputMode="decimal" value={String(qty).replace('.', ',')}
            onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v <= (isGrams ? 5000 : 100)) setQty(v) }}
            className="w-full bg-transparent text-center num text-[44px] font-bold outline-none leading-none" />
          <span className="text-sm text-mute">{isGrams ? 'gram' : `× ${portion.label}`}</span>
        </div>
        <button type="button" aria-label="Artır" onClick={() => setQty((q) => Math.round((q + step) * 100) / 100)} className="w-14 h-14 rounded-2xl bg-surface-2 text-2xl font-bold">+</button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[['Kalori', `${fmtNum(m.kcal)}`, 'kcal'], ['Protein', fmtNum(m.protein, 1), 'g'], ['Karb.', fmtNum(m.carb, 1), 'g'], ['Yağ', fmtNum(m.fat, 1), 'g']].map(([l, v, u]) => (
          <div key={l} className="bg-surface-2 rounded-2xl py-2.5 flex flex-col">
            <span className="text-[11px] text-mute">{l}</span>
            <span className="num text-lg font-bold">{v}</span>
            <span className="text-[11px] text-mute">{u}</span>
          </div>
        ))}
      </div>
      <p className={`text-[13px] text-center ${impact.over ? 'text-orange' : 'text-ink-2'}`} aria-live="polite">
        {grams > 0 ? <><span className="num">{fmtNum(grams, grams % 1 ? 1 : 0)} g</span> · </> : null}
        {impact.pct === null ? 'Bugünkü kalori bütçen doldu.' : impact.over ? `Kalan bütçeni ${fmtNum(m.kcal - remaining)} kcal aşıyor.` : `Kalan bütçenin %${impact.pct}'i.`}
      </p>

      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Öğün">
        {MEALS.map((x) => (
          <button key={x.id} type="button" aria-pressed={meal === x.id} onClick={() => setMeal(x.id)}
            className={`h-10 rounded-full text-[13px] font-bold border ${meal === x.id ? 'bg-lime text-lime-ink border-lime' : 'bg-surface-2 text-ink-2 border-line'}`}>
            {x.label.replace(' yemeği', '')}
          </button>
        ))}
      </div>

      <button type="button" disabled={pending || grams <= 0} onClick={() => onAdd({ grams, portionLabel: portion.label, portionQty: isGrams ? grams : qty, meal })}
        className="h-14 rounded-full bg-lime text-lime-ink font-extrabold text-[17px] disabled:opacity-40">
        {pending ? 'Ekleniyor…' : TO_MEAL[meal]}
      </button>
      {food.approx || food.attribution ? (
        <p className="text-[11px] text-mute text-center leading-relaxed">
          {food.approx ? 'Değerler tahminidir. ' : ''}{food.attribution ? `Kaynak: ${food.attribution}` : ''}
        </p>
      ) : null}
    </div>
  )
}
