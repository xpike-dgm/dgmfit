'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { TopBar } from '@/components/ui'
import { createFood } from '../../actions'

const input = 'h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink outline-none focus:border-lime w-full'

export default function CreateFood({ name, barcode, back }: { name: string; barcode: string; back: string }) {
  const router = useRouter()
  const [v, setV] = useState({ name, brand: '', barcode, servingG: '', servingLabel: '', kcal: '', protein: '', carb: '', fat: '', fiber: '', sugar: '', satFat: '', sodium: '' })
  const [basis, setBasis] = useState<'100g' | 'serving'>('100g')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const n = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  const num = (k: keyof typeof v, label: string, unit: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`cf-${k}`} className="text-xs text-mute">{label} ({unit})</label>
      <input id={`cf-${k}`} inputMode="decimal" value={v[k]} onChange={set(k)} className={input + ' num'} />
    </div>
  )
  const submit = () => {
    setErr(null)
    start(async () => {
      const r = await createFood({
        name: v.name, brand: v.brand || undefined, barcode: v.barcode || '', basis, servingG: n(v.servingG), servingLabel: v.servingLabel || undefined,
        kcal: n(v.kcal) ?? -1, protein: n(v.protein) ?? 0, carb: n(v.carb) ?? 0, fat: n(v.fat) ?? 0,
        fiber: n(v.fiber), sugar: n(v.sugar), satFat: n(v.satFat), sodium: n(v.sodium),
      })
      if (!r.ok) { setErr(r.error); return }
      router.push(back)
    })
  }
  return (
    <div className="px-4 pt-4 flex flex-col gap-3 pb-8">
      <TopBar back={back} title="Yeni besin" />
      <section className="card p-5 flex flex-col gap-3 mt-2">
        <div className="flex flex-col gap-1"><label htmlFor="cf-name" className="text-xs text-mute">Ad</label><input id="cf-name" value={v.name} onChange={set('name')} className={input} placeholder="Ör. Ev yapımı granola" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1"><label htmlFor="cf-brand" className="text-xs text-mute">Marka (isteğe bağlı)</label><input id="cf-brand" value={v.brand} onChange={set('brand')} className={input} /></div>
          <div className="flex flex-col gap-1"><label htmlFor="cf-bc" className="text-xs text-mute">Barkod (isteğe bağlı)</label><input id="cf-bc" inputMode="numeric" value={v.barcode} onChange={(e) => setV({ ...v, barcode: e.target.value.replace(/\D/g, '').slice(0, 14) })} className={input + ' num'} /></div>
        </div>
      </section>
      <section className="card p-5 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-surface-2" role="group" aria-label="Değerler neye göre">
          {([['100g', '100 g başına'], ['serving', 'Porsiyon başına']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={basis === k} onClick={() => setBasis(k)} className={`h-10 rounded-full text-sm font-bold ${basis === k ? 'bg-ink text-bg' : 'text-mute'}`}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {num('servingG', 'Porsiyon', 'g')}
          <div className="flex flex-col gap-1"><label htmlFor="cf-sl" className="text-xs text-mute">Porsiyon adı</label><input id="cf-sl" value={v.servingLabel} onChange={set('servingLabel')} className={input} placeholder="Ör. 1 kase" /></div>
        </div>
        <p className="text-xs text-mute -mt-1">{basis === 'serving' ? 'Etiketteki porsiyon değerlerini gir; 100 g\'a otomatik çevrilir.' : 'Etiketteki 100 g değerlerini gir. Porsiyon isteğe bağlıdır.'}</p>
        <div className="grid grid-cols-2 gap-2">
          {num('kcal', 'Kalori', 'kcal')}{num('protein', 'Protein', 'g')}{num('carb', 'Karbonhidrat', 'g')}{num('fat', 'Yağ', 'g')}
        </div>
        <details>
          <summary className="text-sm font-bold text-ink-2 cursor-pointer min-h-11 flex items-center">Diğer değerler</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">{num('fiber', 'Lif', 'g')}{num('sugar', 'Şeker', 'g')}{num('satFat', 'Doymuş yağ', 'g')}{num('sodium', 'Sodyum', 'mg')}</div>
        </details>
      </section>
      {err ? <p role="alert" className="text-sm font-semibold text-danger px-1">{err}</p> : null}
      <button type="button" disabled={pending || !v.name.trim() || !v.kcal} onClick={submit} className="h-14 rounded-full bg-lime text-lime-ink font-extrabold disabled:opacity-40">{pending ? 'Kaydediliyor…' : 'Besini kaydet'}</button>
    </div>
  )
}
