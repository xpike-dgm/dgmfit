'use client'
import AiOff from '@/components/AiOff'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { fmtNum } from '@/lib/calc'
import { MEAL_LABEL, type MealId } from '@/lib/food'
import type { PantryRecipe } from '@/lib/planner-data'
import { addPortionAction, pantryAction } from '../plan/actions'

export default function PantryClient({ aiOn, meal }: { aiOn: boolean; meal: MealId }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<{ remaining: number; recipes: PantryRecipe[]; note: string | null } | null>(null)
  const [m, setM] = useState<MealId>(meal)
  const [added, setAdded] = useState<Record<number, string>>({})
  const router = useRouter()
  const ask = async () => {
    setBusy(true); setErr(null)
    const r = await pantryAction(text).catch(() => ({ ok: false as const, error: 'Bağlantı yok' }))
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setRes(r); setAdded({})
  }
  return (
    <div className="flex flex-col gap-3" data-testid="pantry">
      <form className="card p-5 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void ask() }}>
        <label htmlFor="pantry-text" className="text-[13px] font-semibold">Buzdolabında ve dolapta ne var?</label>
        <textarea id="pantry-text" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ör: yumurta, domates, biber, beyaz peynir, yarım paket makarna" className="rounded-xl bg-surface-2 border border-line px-3 py-2" />
        {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
        {!aiOn ? <AiOff what="Tarif önerisi" alt={{ href: '/yemek/ekle', label: 'Elle öğün ekle' }} /> : null}
        <button type="submit" className={btn.primary} disabled={!aiOn || busy || text.trim().length < 3}>{busy ? 'Tarifler hazırlanıyor…' : 'Tarif öner'}</button>
      </form>
      {res ? (
        <>
          <p className="text-[13px] text-mute px-1">Bugün kalan bütçe: <b className="num text-ink">{fmtNum(res.remaining)} kcal</b>. Önerilen porsiyon bu bütçeye göre ölçeklendi.</p>
          {res.note ? <p className="text-[13px] text-orange px-1">{res.note}</p> : null}
          {res.recipes.map((r, i) => (
            <section key={i} className="card p-4 flex flex-col gap-2" data-testid="pantry-recipe">
              <div className="flex justify-between gap-2"><span className="font-bold">{r.title}</span><span className="text-[12px] text-mute">{r.minutes} dk · {r.servings} kişilik</span></div>
              <ul className="text-[13px] flex flex-col">{r.ingredients.map((x, k) => <li key={k} className="flex justify-between"><span className={x.foodId ? '' : 'text-mute'}>{x.name} · {fmtNum(x.grams)} g</span><span className="num">{x.kcal === null ? 'eşleşme yok' : `${fmtNum(x.kcal)} kcal`}</span></li>)}</ul>
              <ol className="list-decimal pl-5 text-[13px] text-ink-2 flex flex-col gap-0.5">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
              <p className="text-[14px]">1 porsiyon <b className="num">{fmtNum(r.perServing)} kcal</b> · senin için önerilen <b className="num" data-testid="portion-kcal">{fmtNum(r.portion.kcal)} kcal</b>{r.portion.factor !== 1 ? ` (porsiyonun ${fmtNum(r.portion.factor, 2)} katı)` : ''}</p>
              {added[i] ? <p role="status" className="text-[13px] text-acc">{added[i]}</p> : r.portion.grams.length ? (
                <div className="flex gap-2 items-center">
                  <select aria-label="Öğün" value={m} onChange={(e) => setM(e.target.value as MealId)} className="h-10 rounded-full bg-surface-2 border border-line px-3 text-[13px]">{(Object.keys(MEAL_LABEL) as MealId[]).map((k) => <option key={k} value={k}>{MEAL_LABEL[k]}</option>)}</select>
                  <button type="button" className="h-10 px-4 rounded-full bg-acc text-acc-ink font-bold text-[13px]" onClick={async () => {
                    const a = await addPortionAction({ meal: m, items: r.portion.grams.map((x) => ({ foodId: x.foodId, grams: x.grams })) })
                    setAdded({ ...added, [i]: a.ok ? `${MEAL_LABEL[m]} öğününe eklendi · ${fmtNum(a.kcal)} kcal` : a.error }); router.refresh()
                  }}>Porsiyonu günlüğe ekle</button>
                </div>
              ) : null}
            </section>
          ))}
        </>
      ) : null}
    </div>
  )
}
