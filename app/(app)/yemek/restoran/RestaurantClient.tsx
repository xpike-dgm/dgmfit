'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { fmtNum } from '@/lib/calc'
import { MEAL_LABEL, type MealId } from '@/lib/food'
import { shrinkImage } from '@/lib/client-image'
import { addPortionAction } from '../plan/actions'

type Dish = { name: string; food: string | null; foodId: number | null; grams: number; kcal: number | null; protein: number | null; fits: boolean; over: number }

export default function RestaurantClient({ aiOn, meal }: { aiOn: boolean; meal: MealId }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<{ remaining: number; top: Dish[]; all: Dish[]; note: string | null } | null>(null)
  const [m, setM] = useState<MealId>(meal)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  const send = async (f: File) => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      const fd = new FormData(); fd.set('file', await shrinkImage(f, 1600, 0.85), 'menu.jpg')
      const r = await fetch('/api/ai/restaurant', { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({ error: 'AI yanıtı okunamadı' }))
      if (!r.ok) setErr(j.error ?? 'AI isteği başarısız'); else setRes(j)
    } catch (x) { setErr((x as Error).message || 'Bağlantı yok') } finally { setBusy(false) }
  }
  const add = async (d: Dish) => {
    if (!d.foodId) return
    const a = await addPortionAction({ meal: m, items: [{ foodId: d.foodId, grams: d.grams }] })
    setMsg(a.ok ? `${d.name} ${MEAL_LABEL[m]} öğününe eklendi · ${fmtNum(a.kcal)} kcal` : a.error); router.refresh()
  }
  const Row = ({ d, top }: { d: Dish; top?: boolean }) => (
    <li className={`flex items-center gap-2 ${top ? 'rounded-2xl bg-surface-2 px-3 py-2.5' : 'py-1.5 border-b border-line last:border-0'}`} data-testid={top ? 'rest-top' : 'rest-dish'}>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-semibold text-[14px] truncate">{d.name}</span>
        <span className="text-[12px] text-mute truncate">{d.food ? `${d.food} · ${fmtNum(d.grams)} g` : 'veritabanında eşleşme yok'}</span>
      </span>
      <span className={`num text-[14px] font-bold ${d.kcal !== null && !d.fits ? 'text-orange' : ''}`}>{d.kcal === null ? '—' : `${fmtNum(d.kcal)} kcal`}</span>
      {d.foodId ? <button type="button" onClick={() => void add(d)} className="h-9 px-3 rounded-full bg-lime text-lime-ink font-bold text-[12px]" aria-label={`${d.name} ekle`}>Ekle</button> : null}
    </li>
  )
  return (
    <div className="flex flex-col gap-3" data-testid="restaurant">
      <section className="card p-5 flex flex-col gap-3">
        <p className="text-[13px] text-mute">Menünün fotoğrafını çek; yemeklerin kalorisi veritabanından hesaplanır ve kalan bütçene en uygun 3 seçenek öne çıkar.</p>
        <label className={`${btn.primary} cursor-pointer ${busy || !aiOn ? 'opacity-50' : ''}`}>
          {busy ? 'Menü okunuyor…' : 'Menünün fotoğrafını çek'}
          <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid="rest-photo" disabled={busy || !aiOn} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void send(f) }} />
        </label>
        {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
      </section>
      {res ? (
        <>
          <p className="text-[13px] text-mute px-1">Bugün kalan bütçe: <b className="num text-ink" data-testid="rest-remaining">{fmtNum(res.remaining)} kcal</b></p>
          {res.note ? <p className="text-[13px] text-orange px-1">{res.note}</p> : null}
          <label className="flex items-center justify-between text-[13px] font-semibold px-1">Öğün
            <select value={m} onChange={(e) => setM(e.target.value as MealId)} className="h-10 rounded-full bg-surface-2 border border-line px-3 font-normal">{(Object.keys(MEAL_LABEL) as MealId[]).map((k) => <option key={k} value={k}>{MEAL_LABEL[k]}</option>)}</select>
          </label>
          {msg ? <p role="status" className="text-[13px] text-lime px-1">{msg}</p> : null}
          <section className="card p-4 flex flex-col gap-2"><span className="font-bold">En uygun 3 seçenek</span><ul className="flex flex-col gap-2">{res.top.map((d, i) => <Row key={i} d={d} top />)}</ul></section>
          <section className="card px-4 py-3 flex flex-col"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute mb-1">Tüm menü</span><ul>{res.all.map((d, i) => <Row key={i} d={d} />)}</ul></section>
        </>
      ) : null}
    </div>
  )
}
