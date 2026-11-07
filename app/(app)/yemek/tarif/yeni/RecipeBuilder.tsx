'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { TopBar } from '@/components/ui'
import { Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { computeRecipe } from '@/lib/nutrition'
import { createRecipe, importRecipeUrlAction } from '../../actions'

interface Hit { id: number; name: string; sub: string | null; per100: Record<string, number>; kcal: number }
interface Ing extends Hit { grams: number }
const input = 'h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink outline-none focus:border-acc'

export default function RecipeBuilder({ back }: { back: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [servings, setServings] = useState('4')
  const [yieldG, setYieldG] = useState('')
  const [ings, setIngs] = useState<Ing[]>([])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [url, setUrl] = useState('')
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const doImport = () => {
    setImportMsg(null)
    start(async () => {
      const r = await importRecipeUrlAction(url)
      if (!r.ok) { setImportMsg(r.error); return }
      setName(r.name); if (r.servings) setServings(String(r.servings))
      const got = r.ingredients.filter((i) => i.food)
      setIngs(got.map((i) => ({ ...i.food!, grams: i.grams ?? 0 })))
      setUnmatched(r.ingredients.filter((i) => !i.food).map((i) => i.text))
      const noG = got.filter((i) => i.grams === null).length
      setImportMsg(`${got.length} malzeme eşleşti${noG ? `, ${noG} tanesinin gramını gir` : ''}${r.ingredients.length - got.length ? `, ${r.ingredients.length - got.length} tanesi bulunamadı (aşağıdan elle ekle)` : ''}. Eşleşmeleri kontrol et.`)
    })
  }

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try { const r = await fetch('/api/food/search?q=' + encodeURIComponent(q), { signal: ctl.signal }); setHits((await r.json()).results?.slice(0, 8) ?? []) } catch { /* iptal */ }
    }, 220)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q])

  const sv = Math.max(1, Number(servings) || 1)
  const calc = useMemo(() => {
    const list = ings.filter((i) => i.grams > 0)
    if (!list.length) return null
    const r = computeRecipe(list.map((i) => ({ per100: i.per100, grams: i.grams })), Number(yieldG) > 0 ? Number(yieldG) : undefined)
    // porsiyon değerleri yuvarlanmış 100 g değerinden değil, malzeme toplamından
    const portion = r.yieldGrams / sv
    return { portion, kcal: Math.round((r.total.kcal ?? 0) / sv), p: (r.total.protein ?? 0) / sv, c: (r.total.carb ?? 0) / sv, fat: (r.total.fat ?? 0) / sv, raw: r.rawGrams, per100: r.per100 }
  }, [ings, yieldG, sv])

  const save = () => {
    setErr(null)
    start(async () => {
      const r = await createRecipe({ name, servings: sv, yieldG: Number(yieldG) > 0 ? Number(yieldG) : undefined, ingredients: ings.filter((i) => i.grams > 0).map((i) => ({ foodId: i.id, grams: i.grams })) })
      if (!r.ok) { setErr(r.error); return }
      router.push(back)
    })
  }

  return (
    <div className="px-4 flex flex-col gap-3 pb-8">
      <TopBar back={back} title="Yeni tarif" />
      <section className="card p-4 flex flex-col gap-2 mt-2" aria-label="Linkten içe aktar" data-testid="recipe-url">
        <label htmlFor="rb-url" className="text-xs text-mute">Tarif linki (isteğe bağlı): malzemeler otomatik eklenir</label>
        <div className="flex gap-2">
          <input id="rb-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="https://…" className={input + ' flex-1 min-w-0'} />
          <button type="button" disabled={pending || !/^https:\/\/\S+\.\S+/.test(url)} onClick={doImport} className="h-12 px-4 rounded-xl bg-acc text-acc-ink font-bold disabled:opacity-40 shrink-0">{pending ? '…' : 'Getir'}</button>
        </div>
        {importMsg ? <p role="status" className="text-[13px] text-ink-2">{importMsg}</p> : null}
        {unmatched.length ? <ul className="text-[12px] text-mute list-disc pl-5" data-testid="recipe-unmatched">{unmatched.map((u) => <li key={u}>{u}</li>)}</ul> : null}
      </section>
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1"><label htmlFor="rb-name" className="text-xs text-mute">Tarif adı</label><input id="rb-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={input + ' w-full'} placeholder="Ör. Annemin mercimek köftesi" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1"><label htmlFor="rb-sv" className="text-xs text-mute">Kaç porsiyon?</label><input id="rb-sv" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, '').slice(0, 2))} className={input + ' num'} /></div>
          <div className="flex flex-col gap-1"><label htmlFor="rb-y" className="text-xs text-mute">Pişmiş ağırlık (g, isteğe bağlı)</label><input id="rb-y" inputMode="numeric" value={yieldG} onChange={(e) => setYieldG(e.target.value.replace(/\D/g, '').slice(0, 5))} className={input + ' num'} placeholder={calc ? String(Math.round(calc.raw)) : ''} /></div>
        </div>
        <p className="text-xs text-mute -mt-1">Tencerenin tamamını tartarsan porsiyon hesabı çok daha doğru olur (pişerken su kaybı/emilimi).</p>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-extrabold">Malzemeler</h2>
        {ings.map((i, k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-sm font-semibold truncate">{i.name}</span>
            <label htmlFor={`rb-g-${k}`} className="sr-only">{i.name} gram</label>
            <input id={`rb-g-${k}`} inputMode="decimal" value={i.grams || ''} onChange={(e) => { const g = Number(e.target.value.replace(',', '.')); setIngs((x) => x.map((y, j) => (j === k ? { ...y, grams: Number.isFinite(g) ? g : 0 } : y))) }} className={input + ' w-24 num text-right' + (i.grams > 0 ? '' : ' border-orange')} placeholder="gram" />
            <span className="text-xs text-mute">g</span>
            <button type="button" aria-label={`${i.name} kaldır`} onClick={() => setIngs((x) => x.filter((_, j) => j !== k))} className="w-10 h-10 flex items-center justify-center text-mute"><Trash size={16} /></button>
          </div>
        ))}
        <div className="relative">
          <label htmlFor="rb-q" className="sr-only">Malzeme ara</label>
          <input id="rb-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Malzeme ekle (ör. kırmızı mercimek)" className={input + ' w-full'} autoComplete="off" />
          {hits.length ? (
            <ul className="mt-2 rounded-2xl bg-surface-2 overflow-hidden">
              {hits.map((h) => (
                <li key={h.id}><button type="button" onClick={() => { setIngs((x) => [...x, { ...h, grams: 100 }]); setQ(''); setHits([]) }} className="w-full flex justify-between items-center px-4 min-h-[48px] text-left border-t border-surface first:border-t-0">
                  <span className="text-sm truncate">{h.name}</span><span className="num text-xs text-mute shrink-0 ml-2">{fmtNum(h.kcal)} kcal/100 g</span>
                </button></li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {calc ? (
        <section aria-label="Porsiyon değerleri" className="rounded-[24px] p-5 bg-coach border border-coach-line flex flex-col gap-2" aria-live="polite">
          <span className="text-sm text-ink-2">1 porsiyon ≈ <b className="num text-ink">{fmtNum(calc.portion)} g</b></span>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['Kalori', fmtNum(calc.kcal)], ['Protein', fmtNum(calc.p, 1)], ['Karb.', fmtNum(calc.c, 1)], ['Yağ', fmtNum(calc.fat, 1)]].map(([l, v]) => (
              <div key={l} className="flex flex-col"><span className="text-[11px] text-mute">{l}</span><span className="num font-bold">{v}</span></div>
            ))}
          </div>
        </section>
      ) : null}
      {err ? <p role="alert" className="text-sm font-semibold text-danger px-1">{err}</p> : null}
      <button type="button" disabled={pending || !name.trim() || !ings.some((i) => i.grams > 0)} onClick={save} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40">{pending ? 'Kaydediliyor…' : 'Tarifi kaydet'}</button>
    </div>
  )
}
