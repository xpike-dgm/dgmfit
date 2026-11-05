'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { Close, Plus, Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { COMMON_EXTRAS, EXTRA_UNITS, SUPP_UNITS, suppError, type SuppInput, type SuppUnit } from '@/lib/supplements'
import { deleteSupplementAction, saveSupplementAction } from './actions'

export interface FormInit { name: string; brand: string | null; unit: string; servingG: number | null; kcal: number; protein: number; carb: number; fat: number; extras: { name: string; amount: number; unit: string }[]; daily: number | null }
const field = 'w-full h-12 rounded-2xl bg-surface-2 border border-line px-4 text-[16px] outline-none focus:border-acc'
const str = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? '' : String(n).replace('.', ','))
const num = (s: string) => { const n = Number(s.replace(',', '.')); return s.trim() === '' ? 0 : Number.isFinite(n) ? n : NaN }

export default function SuppForm({ id, init }: { id: number | null; init?: FormInit }) {
  const router = useRouter()
  const [name, setName] = useState(init?.name ?? '')
  const [brand, setBrand] = useState(init?.brand ?? '')
  const [unit, setUnit] = useState<SuppUnit>((init?.unit as SuppUnit) ?? 'ölçek')
  const [servingG, setServingG] = useState(str(init?.servingG))
  const [m, setM] = useState({ kcal: str(init?.kcal), protein: str(init?.protein), carb: str(init?.carb), fat: str(init?.fat) })
  const [extras, setExtras] = useState(init?.extras.map((e) => ({ name: e.name, amount: str(e.amount), unit: e.unit })) ?? [])
  const [daily, setDaily] = useState(str(init?.daily))
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const clean = (v: string) => v.replace(/[^0-9.,]/g, '').slice(0, 7)
  const input: SuppInput = { name, brand: brand || null, unit, servingG: servingG ? num(servingG) : null, kcal: num(m.kcal), protein: num(m.protein), carb: num(m.carb), fat: num(m.fat), extras: extras.map((e) => ({ name: e.name, amount: num(e.amount), unit: e.unit })), daily: daily ? num(daily) : null }
  const live = name.trim() ? suppError(input) : null
  const estKcal = Math.round(input.protein * 4 + input.carb * 4 + input.fat * 9)

  function save() {
    start(async () => {
      const r = await saveSupplementAction(id, { ...input, extras: input.extras })
      if (!r.ok) { setErr(r.error); return }
      router.push('/yemek/takviyeler'); router.refresh()
    })
  }
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-[14px] font-bold">Adı
          <input id="supp-name" className={field} value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="ör. Whey protein, Kreatin, D3" /></label>
        <label className="flex flex-col gap-1.5 text-[14px] font-bold">Marka <span className="sr-only">(isteğe bağlı)</span>
          <input id="supp-brand" className={field} value={brand} onChange={(e) => setBrand(e.target.value.slice(0, 60))} placeholder="isteğe bağlı" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-[14px] font-bold">1 porsiyon
            <select id="supp-unit" className={field} value={unit} onChange={(e) => setUnit(e.target.value as SuppUnit)}>{SUPP_UNITS.map((u) => <option key={u} value={u}>{u === 'g' ? 'gram (g)' : u === 'ml' ? 'mililitre (ml)' : `1 ${u}`}</option>)}</select></label>
          <label className="flex flex-col gap-1.5 text-[14px] font-bold">{unit === 'g' || unit === 'ml' ? `1 porsiyon kaç ${unit}?` : 'Kaç gram?'}
            <input id="supp-g" className={field + ' num'} inputMode="decimal" value={servingG} onChange={(e) => setServingG(clean(e.target.value))} placeholder={unit === 'g' || unit === 'ml' ? 'ör. 5' : 'bilmiyorsan boş'} /></label>
        </div>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h2 className="text-[15px] font-extrabold">{unit === 'g' || unit === 'ml' ? `1 porsiyonda${servingG ? ` (${servingG} ${unit})` : ''}` : `1 ${unit} içinde`} <span className="text-mute text-[13px] font-semibold">(etiketteki porsiyon değeri)</span></h2>
        <div className="grid grid-cols-2 gap-2">
          {([['kcal', 'Kalori', 'kcal'], ['protein', 'Protein', 'g'], ['carb', 'Karbonhidrat', 'g'], ['fat', 'Yağ', 'g']] as const).map(([k, l, u]) => (
            <label key={k} className="flex flex-col gap-1 text-[12.5px] font-bold text-mute">{l} ({u})
              <input id={`supp-${k}`} className={field + ' num text-ink'} inputMode="decimal" value={m[k]} onChange={(e) => setM({ ...m, [k]: clean(e.target.value) })} placeholder="0" /></label>
          ))}
        </div>
        {estKcal > 0 && !m.kcal ? <button type="button" className="self-start text-[13px] font-bold text-acc" onClick={() => setM({ ...m, kcal: String(estKcal) })}>Kaloriyi makrolardan hesapla: {fmtNum(estKcal)} kcal</button> : null}
      </section>

      <section className="card p-4 flex flex-col gap-3" aria-label="Diğer içerikler">
        <h2 className="text-[15px] font-extrabold">Diğer içerikler <span className="text-mute text-[13px] font-semibold">(isteğe bağlı)</span></h2>
        {extras.map((e, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_64px_36px] gap-1.5 items-center" data-testid="supp-extra">
            <input aria-label="İçerik adı" className={field + ' h-11 px-3 text-[15px]'} value={e.name} onChange={(v) => setExtras(extras.map((x, j) => (j === i ? { ...x, name: v.target.value.slice(0, 40) } : x)))} placeholder="ad" />
            <input aria-label="Miktar" className={field + ' h-11 px-2 num text-[15px]'} inputMode="decimal" value={e.amount} onChange={(v) => setExtras(extras.map((x, j) => (j === i ? { ...x, amount: clean(v.target.value) } : x)))} placeholder="0" />
            <select aria-label="Birim" className={field + ' h-11 px-1.5 text-[14px]'} value={e.unit} onChange={(v) => setExtras(extras.map((x, j) => (j === i ? { ...x, unit: v.target.value } : x)))}>{EXTRA_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <button type="button" aria-label="İçeriği kaldır" className="w-9 h-9 rounded-full flex items-center justify-center text-mute" onClick={() => setExtras(extras.filter((_, j) => j !== i))}><Close size={16} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {COMMON_EXTRAS.filter((c) => !extras.some((e) => e.name === c.name)).slice(0, 8).map((c) => (
            <button key={c.name} type="button" className="h-8 px-3 rounded-full border border-line-2 text-[12.5px] font-bold inline-flex items-center gap-1" onClick={() => setExtras([...extras, { name: c.name, amount: '', unit: c.unit }])}><Plus size={13} />{c.name}</button>
          ))}
          <button type="button" className="h-8 px-3 rounded-full border border-dashed border-line-2 text-[12.5px] font-bold" onClick={() => setExtras([...extras, { name: '', amount: '', unit: 'mg' }])}>Başka</button>
        </div>
      </section>

      <section className="card p-4 flex flex-col gap-2">
        <label className="flex flex-col gap-1.5 text-[14px] font-bold">Günlük hedef <span className="text-mute text-[12.5px] font-semibold">Günde kaç {unit}? Boş bırakırsan hedef gösterilmez.</span>
          <input id="supp-daily" className={field + ' num'} inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="ör. 1" /></label>
      </section>

      <p className="text-[12px] text-mute leading-snug px-1">Değerleri ürün etiketindeki “1 porsiyon” sütunundan gir. Takviye edici gıdalar ilaç değildir; düzenli kullanımda hekimine danış.</p>
      {(err || live) ? <p role="status" className="text-[13.5px] font-semibold text-danger px-1">{err ?? live}</p> : null}
      <button type="button" className={btn.primary} disabled={pending || !!live || !name.trim()} onClick={save} data-testid="supp-save">{pending ? 'Kaydediliyor…' : id ? 'Kaydet' : 'Takviyeyi ekle'}</button>
      {id ? (
        <button type="button" className={btn.secondary + ' text-danger'} disabled={pending} onClick={() => confirm(`${name} silinsin mi? Geçmiş kayıtların günlükte kalır.`) && start(async () => { await deleteSupplementAction(id); router.push('/yemek/takviyeler'); router.refresh() })}><Trash size={16} /> Takviyeyi sil</button>
      ) : null}
    </div>
  )
}
