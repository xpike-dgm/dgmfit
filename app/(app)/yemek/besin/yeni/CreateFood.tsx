'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { shrinkImage } from '@/lib/client-image'
import { btn } from '@/components/ui'
import { TopBar } from '@/components/ui'
import { createFood, updateFood } from '../../actions'
import type { FoodUnit } from '@/lib/food'

const input = 'h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink outline-none focus:border-acc w-full'

type Init = { brand: string; unit: FoodUnit; servingG: string; servingLabel: string; kcal: string; protein: string; carb: string; fat: string; fiber: string; sugar: string; satFat: string; sodium: string }

/** Yeni besin / G1: düzenleme (editId) ve içecekler için ml birimi. */
export default function CreateFood({ name, barcode, back, aiOn = false, editId, initial }: { name: string; barcode: string; back: string; aiOn?: boolean; editId?: number; initial?: Init }) {
  const router = useRouter()
  const { unit: unit0 = 'g', ...rest } = initial ?? {}
  const [v, setV] = useState({ name, brand: '', barcode, servingG: '', servingLabel: '', kcal: '', protein: '', carb: '', fat: '', fiber: '', sugar: '', satFat: '', sodium: '', ...rest })
  const [unit, setUnit] = useState<FoodUnit>(unit0)
  const [basis, setBasis] = useState<'100g' | 'serving'>('100g')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [ocr, setOcr] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null })
  /** Etiket fotoğrafı → AI yalnızca tabloda yazanı okur; porsiyon bazlıysa 100 g'a sunucu çevirir. Tuz (g) → sodyum (mg) = tuz × 400. */
  const readLabel = async (f: File) => {
    setOcr({ busy: true, msg: null })
    try {
      const fd = new FormData(); fd.set('file', await shrinkImage(f, 1600, 0.9), 'etiket.jpg')
      const r = await fetch('/api/ai/label', { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({ error: 'Yanıt okunamadı' }))
      if (!r.ok) { setOcr({ busy: false, msg: j.error ?? 'Etiket okunamadı' }); return }
      if (!j.per100) { setOcr({ busy: false, msg: 'Tablo okunamadı; daha yakından ve düz çekmeyi dene.' }); return }
      const p = j.per100 as Record<string, number | null>
      const str = (x: number | null | undefined) => (x === null || x === undefined ? '' : String(x).replace('.', ','))
      setBasis('100g')
      setV((o) => ({ ...o, name: o.name || j.label.name || '', brand: o.brand || j.label.brand || '', kcal: str(p.kcal), protein: str(p.protein), carb: str(p.carb), fat: str(p.fat), fiber: str(p.fiber), sugar: str(p.sugar), satFat: str(p.satFat), sodium: p.salt === null || p.salt === undefined ? '' : String(Math.round(p.salt * 400)), servingG: j.label.servingGrams ? String(j.label.servingGrams) : o.servingG }))
      setOcr({ busy: false, msg: 'Etiketten dolduruldu (100 g başına). Kaydetmeden önce paketteki değerlerle karşılaştır.' })
    } catch (x) { setOcr({ busy: false, msg: (x as Error).message || 'Bağlantı yok' }) }
  }
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
      const input = {
        name: v.name, brand: v.brand || undefined, barcode: v.barcode || '', basis, unit, servingG: n(v.servingG), servingLabel: v.servingLabel || undefined,
        kcal: n(v.kcal) ?? -1, protein: n(v.protein) ?? 0, carb: n(v.carb) ?? 0, fat: n(v.fat) ?? 0,
        fiber: n(v.fiber), sugar: n(v.sugar), satFat: n(v.satFat), sodium: n(v.sodium),
      }
      const r = editId ? await updateFood(editId, input) : await createFood(input)
      if (!r.ok) { setErr(r.error); return }
      router.push(back); router.refresh()
    })
  }
  return (
    <div className="px-4 flex flex-col gap-3 pb-8">
      <TopBar back={back} title={editId ? 'Besini düzenle' : 'Yeni besin'} />
      {aiOn ? (
        <section className="card p-4 flex flex-col gap-2 mt-2" data-testid="label-ocr">
          <label className={`${btn.secondary} cursor-pointer ${ocr.busy ? 'opacity-50' : ''}`}>
            {ocr.busy ? 'Etiket okunuyor…' : 'Besin değeri tablosunu fotoğrafla (AI)'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid="label-input" disabled={ocr.busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readLabel(f) }} />
          </label>
          {ocr.msg ? <p role="status" className="text-[13px] text-ink-2">{ocr.msg}</p> : null}
        </section>
      ) : null}
      {v.barcode ? <p className="text-[12px] text-mute px-1" data-testid="barcode-shared">Barkodlu ürünler paylaşılır: bu barkodu okutan diğer kullanıcılar ürünü (adı, markası, besin değerleri) bulur. Senin adın görünmez.</p> : null}
      <section className="card p-5 flex flex-col gap-3 mt-2">
        <div className="flex flex-col gap-1"><label htmlFor="cf-name" className="text-xs text-mute">Ad</label><input id="cf-name" value={v.name} onChange={set('name')} className={input} placeholder="Ör. Ev yapımı granola" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1"><label htmlFor="cf-brand" className="text-xs text-mute">Marka (isteğe bağlı)</label><input id="cf-brand" value={v.brand} onChange={set('brand')} className={input} /></div>
          <div className="flex flex-col gap-1"><label htmlFor="cf-bc" className="text-xs text-mute">Barkod (isteğe bağlı)</label><input id="cf-bc" inputMode="numeric" value={v.barcode} onChange={(e) => setV({ ...v, barcode: e.target.value.replace(/\D/g, '').slice(0, 14) })} className={input + ' num'} /></div>
        </div>
      </section>
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-mute">Bu bir…</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Birim">
            {([['g', 'Yiyecek', 'gram (g)', <path key="g" d="M4 11h16M5 11a7 7 0 0014 0M12 4v3" />], ['ml', 'İçecek', 'mililitre (ml)', <path key="m" d="M7 3h10l-1.5 17.5a1 1 0 01-1 .5h-5a1 1 0 01-1-.5zM7.5 9h9" />]] as const).map(([k, l, sub, icon]) => (
              <button key={k} type="button" role="radio" aria-checked={unit === k} onClick={() => setUnit(k)} data-testid={`unit-${k}`}
                className="min-h-[60px] rounded-2xl border border-line bg-surface-2 px-3 flex items-center gap-2.5 text-left aria-checked:border-2 aria-checked:border-acc aria-checked:bg-[color-mix(in_oklab,var(--color-acc)_10%,var(--color-surface-2))]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-acc shrink-0" aria-hidden>{icon}</svg>
                <span className="flex flex-col leading-tight"><b className="text-[14px]">{l}</b><span className="text-[11.5px] text-mute">{sub}</span></span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-surface-2" role="group" aria-label="Değerler neye göre">
          {([['100g', `100 ${unit} başına`], ['serving', 'Porsiyon başına']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={basis === k} onClick={() => setBasis(k)} className={`h-10 rounded-full text-sm font-bold ${basis === k ? 'bg-ink text-bg' : 'text-mute'}`}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {num('servingG', 'Porsiyon', unit)}
          <div className="flex flex-col gap-1"><label htmlFor="cf-sl" className="text-xs text-mute">Porsiyon adı</label><input id="cf-sl" value={v.servingLabel} onChange={set('servingLabel')} className={input} placeholder={unit === 'ml' ? 'Ör. 1 kutu' : 'Ör. 1 kase'} /></div>
        </div>
        <p className="text-xs text-mute -mt-1">{basis === 'serving' ? `Etiketteki porsiyon değerlerini gir; 100 ${unit}'e otomatik çevrilir.` : `Etiketteki 100 ${unit} değerlerini gir. Porsiyon isteğe bağlıdır.`}{unit === 'ml' ? ' İçeceklerde 1 ml ≈ 1 g sayılır.' : ''}</p>
        <div className="grid grid-cols-2 gap-2">
          {num('kcal', 'Kalori', 'kcal')}{num('protein', 'Protein', 'g')}{num('carb', 'Karbonhidrat', 'g')}{num('fat', 'Yağ', 'g')}
        </div>
        <details>
          <summary className="text-sm font-bold text-ink-2 cursor-pointer min-h-11 flex items-center">Diğer değerler</summary>
          <div className="grid grid-cols-2 gap-2 mt-2">{num('fiber', 'Lif', 'g')}{num('sugar', 'Şeker', 'g')}{num('satFat', 'Doymuş yağ', 'g')}{num('sodium', 'Sodyum', 'mg')}</div>
        </details>
      </section>
      {err ? <p role="alert" className="text-sm font-semibold text-danger px-1">{err}</p> : null}
      <button type="button" disabled={pending || !v.name.trim() || !v.kcal} onClick={submit} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40">{pending ? 'Kaydediliyor…' : editId ? 'Değişiklikleri kaydet' : 'Besini kaydet'}</button>
    </div>
  )
}
