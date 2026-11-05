'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import Sheet from '@/components/Sheet'
import FoodSheet, { type SheetFood } from '@/components/FoodSheet'
import BarcodeScanner from '@/components/BarcodeScanner'
import { btn } from '@/components/ui'
import { Back, Check, Plus } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { MEAL_LABEL, type MealId } from '@/lib/food'
import { addMealItem, addSavedMeal, deleteUserFood } from '../actions'
import AiMeal from './AiMeal'

interface Hit extends SheetFood { kcal: number; source: string; count?: number }

export default function AddFood({ day, meal, remaining, recent, saved, mine, startBarcode, aiOn }: {
  day: string; meal: MealId; remaining: number; recent: Hit[]; saved: { id: string; name: string; count: number }[]; mine: Hit[]; startBarcode: boolean; aiOn: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Hit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'recent' | 'saved' | 'mine'>('recent')
  const [selected, setSelected] = useState<Hit | null>(null)
  const [scan, setScan] = useState(startBarcode)
  const [barcodeMsg, setBarcodeMsg] = useState<{ code: string; text: string } | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const [left, setLeft] = useState(remaining)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return }
    setLoading(true)
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/food/search?q=' + encodeURIComponent(q), { signal: ctl.signal })
        const j = await r.json()
        setResults(j.results ?? [])
      } catch { /* iptal */ } finally { setLoading(false) }
    }, 220)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q])

  const onBarcode = async (code: string) => {
    setScan(false); setBarcodeMsg(null)
    const r = await fetch('/api/food/barcode?code=' + code)
    const j = await r.json()
    if (j.hit) setSelected(j.hit)
    else setBarcodeMsg({ code, text: j.error ?? 'Bu barkodla kayıtlı ürün bulunamadı.' })
  }

  const add = (v: { grams: number; portionLabel: string; portionQty: number; meal: MealId }) => {
    if (!selected) return
    const f = selected
    start(async () => {
      const r = await addMealItem({ foodId: f.id, ...v, day, source: f.count ? 'recent' : 'search' })
      if (r.ok) { setAdded((a) => [`${f.name} · ${fmtNum(r.kcal)} kcal`, ...a].slice(0, 5)); setLeft((l) => l - r.kcal); setSelected(null); router.refresh() }
      else alert(r.error)
    })
  }

  const list = results ?? (tab === 'recent' ? recent : tab === 'mine' ? mine : [])

  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Link href={`/yemek${day ? `?gun=${day}` : ''}`} aria-label="Geri" className={btn.icon}><Back size={20} /></Link>
        <div className="flex flex-col">
          <span className="font-extrabold">{MEAL_LABEL[meal]}</span>
          <span className="text-xs text-mute">Kalan bütçe <b className="num text-ink-2">{fmtNum(left)} kcal</b></span>
        </div>
      </div>

      <div className="relative">
        <label htmlFor="food-q" className="sr-only">Besin ara</label>
        <input id="food-q" autoFocus={!startBarcode} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Besin veya yemek ara (ör. mercimek çorbası)"
          className="w-full h-14 rounded-2xl bg-surface border border-line pl-4 pr-28 text-[16px] text-ink placeholder:text-faint outline-none focus:border-lime" autoComplete="off" />
        <button type="button" onClick={() => setScan(true)} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-11 px-4 rounded-xl bg-surface-2 text-sm font-bold">Barkod</button>
      </div>

      {aiOn ? <AiMeal day={day} meal={meal} onAdded={(lines, kcal) => { setAdded((a) => [...lines, ...a].slice(0, 6)); setLeft((l) => l - kcal) }} /> : null}

      {added.length ? (
        <div className="rounded-2xl bg-coach border border-coach-line px-4 py-3 text-sm flex flex-col gap-1" role="status">
          {added.map((a, i) => <span key={i} className="flex items-center gap-2"><Check size={14} className="text-lime" />{a}</span>)}
          <Link href={`/yemek?gun=${day}`} className="text-lime font-bold text-sm mt-1">Günlüğe dön</Link>
        </div>
      ) : null}

      {barcodeMsg ? (
        <div className="card p-4 flex flex-col gap-2 text-sm">
          <span>{barcodeMsg.text} <span className="num text-mute">({barcodeMsg.code})</span></span>
          <Link href={`/yemek/besin/yeni?barkod=${barcodeMsg.code}&ogun=${meal}&gun=${day}`} className={btn.secondary + ' self-start'}>Ürünü kendim ekle</Link>
        </div>
      ) : null}

      {results === null ? (
        <nav className="grid grid-cols-3 gap-1.5 p-1 rounded-full bg-surface" aria-label="Liste">
          {([['recent', 'Son kullanılan'], ['saved', 'Kayıtlı öğün'], ['mine', 'Besinlerim']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`h-10 rounded-full text-[13px] font-bold ${tab === k ? 'bg-ink text-bg' : 'text-mute'}`}>{l}</button>
          ))}
        </nav>
      ) : null}

      {results === null && tab === 'saved' ? (
        <ul className="card px-4 py-1">
          {saved.length === 0 ? <li className="py-4 text-sm text-mute">Henüz kayıtlı öğün yok. Günlükte bir öğünün menüsünden "Öğünü kaydet"i kullan.</li> : null}
          {saved.map((s) => (
            <li key={s.id} className="flex items-center justify-between min-h-[56px] border-t border-surface-2 first:border-t-0">
              <span className="flex flex-col"><span className="font-bold text-sm">{s.name}</span><span className="text-xs text-mute">{s.count} besin</span></span>
              <button type="button" disabled={pending} className="h-10 px-4 rounded-full bg-lime text-lime-ink text-sm font-extrabold"
                onClick={() => start(async () => { const r = await addSavedMeal(s.id, meal, day); if (r.ok) { setAdded((a) => [`${s.name} · ${r.count} besin`, ...a]); router.refresh() } else alert(r.error) })}>Ekle</button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="card px-2 py-1" aria-busy={loading}>
          {results !== null && !loading && list.length === 0 ? (
            <li className="p-4 text-sm text-mute flex flex-col gap-2">
              <span>"{q}" için sonuç yok.</span>
              <Link href={`/yemek/besin/yeni?ad=${encodeURIComponent(q)}&ogun=${meal}&gun=${day}`} className="text-lime font-bold">Yeni besin olarak ekle</Link>
            </li>
          ) : null}
          {results === null && tab === 'recent' && recent.length === 0 ? <li className="p-4 text-sm text-mute">Henüz kayıt yok. Yukarıdan arayarak başla.</li> : null}
          {results === null && tab === 'mine' ? (
            <li className="flex gap-2 p-2">
              <Link href={`/yemek/besin/yeni?ogun=${meal}&gun=${day}`} className={btn.secondary + ' flex-1 h-11 text-sm'}><Plus size={16} /> Besin oluştur</Link>
              <Link href={`/yemek/tarif/yeni?ogun=${meal}&gun=${day}`} className={btn.secondary + ' flex-1 h-11 text-sm'}><Plus size={16} /> Tarif oluştur</Link>
            </li>
          ) : null}
          {list.map((f) => (
            <li key={f.id} className="flex items-center border-t border-surface-2 first:border-t-0">
              <button type="button" onClick={() => setSelected(f)} className="flex-1 flex items-center gap-3 min-h-[60px] px-2 text-left">
                <span className="flex flex-col flex-1 min-w-0">
                  <span className="text-[15px] font-bold truncate">{f.name}</span>
                  <span className="text-xs text-mute truncate">{f.sub ?? ''}{f.count ? ` · ${f.count} kez` : ''}</span>
                </span>
                <span className="flex flex-col items-end shrink-0">
                  <span className="num text-sm font-semibold">{fmtNum(f.kcal)}</span>
                  <span className="text-[11px] text-mute">kcal/100 g</span>
                </span>
              </button>
              {tab === 'mine' && results === null ? (
                <button type="button" aria-label={`${f.name} sil`} className="w-10 h-10 text-mute" onClick={() => start(async () => { await deleteUserFood(f.id); router.refresh() })}>×</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-mute text-center px-4 pb-2">Besin verisi: USDA FoodData Central (kamu malı) · paketli ürünler: © Open Food Facts katkıcıları (ODbL) · Türk yemekleri: DgFit tarifleri, USDA malzemelerinden hesaplanmıştır.</p>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected ? <FoodSheet food={selected} meal={meal} remaining={left} onAdd={add} pending={pending} /> : null}
      </Sheet>
      <Sheet open={scan} onClose={() => setScan(false)} title="Barkod okut">
        {scan ? <div className="pb-4"><BarcodeScanner onCode={onBarcode} /></div> : null}
      </Sheet>
    </div>
  )
}
