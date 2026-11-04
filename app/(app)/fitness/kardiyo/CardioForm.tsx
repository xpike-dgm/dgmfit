'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { Trash } from '@/components/icons'
import { deleteCardioAction, logCardioAction } from '../actions'

export function CardioForm({ types, today }: { types: { id: string; label: string; distance: boolean }[]; today: string }) {
  const [type, setType] = useState('run')
  const [min, setMin] = useState('30')
  const [km, setKm] = useState('')
  const [hr, setHr] = useState('')
  const [intensity, setIntensity] = useState<'hafif' | 'orta' | 'yoğun'>('orta')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const t = types.find((x) => x.id === type)!
  const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null)
  return (
    <form className="card p-5 flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      start(async () => {
        const r = await logCardioAction({ type, minutes: num(min) ?? 0, distanceKm: t.distance ? num(km) : null, avgHr: num(hr), intensity, day: today, note: null })
        if (!r.ok) { setMsg({ ok: false, t: r.error }); return }
        setMsg({ ok: true, t: `Kaydedildi: net ${r.net} kcal (brüt ${r.gross}) · ${r.method === 'acsm' ? 'hız denklemi' : r.method === 'nabız' ? 'nabız formülü' : 'MET tablosu'}.` }); setKm(''); setHr(''); router.refresh()
      })
    }}>
      <Eyebrow>Kardiyo ekle</Eyebrow>
      <div className="flex flex-wrap gap-1.5">
        {types.map((x) => <button key={x.id} type="button" aria-pressed={type === x.id} onClick={() => setType(x.id)} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${type === x.id ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}>{x.label}</button>)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label htmlFor="c-min" className="flex flex-col gap-1 text-[13px] font-semibold">Süre (dk)<input id="c-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className="h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink" /></label>
        {t.distance ? <label htmlFor="c-km" className="flex flex-col gap-1 text-[13px] font-semibold">Mesafe (km)<input id="c-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="isteğe bağlı" className="h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink" /></label> : <span />}
        <label htmlFor="c-hr" className="flex flex-col gap-1 text-[13px] font-semibold">Ort. nabız<input id="c-hr" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="isteğe bağlı" className="h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink" /></label>
      </div>
      <fieldset className="flex gap-1.5">
        <legend className="text-[13px] font-semibold mb-1.5">Yoğunluk</legend>
        {(['hafif', 'orta', 'yoğun'] as const).map((k) => <button key={k} type="button" aria-pressed={intensity === k} onClick={() => setIntensity(k)} className={`flex-1 h-10 rounded-xl text-[13px] font-bold capitalize ${intensity === k ? 'bg-lime text-lime-ink' : 'bg-surface-2'}`}>{k}</button>)}
      </fieldset>
      <p className="text-[12px] text-mute leading-relaxed">Kalori: nabız girersen nabız formülü (Keytel), koşu/yürüyüşte mesafe girersen hız denklemi (ACSM), yoksa MET tablosu. Fit'e dinlenme harcaması düşülmüş net kalori eklenir.</p>
      <button type="submit" className={btn.primary} disabled={pending}>Kaydet</button>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-lime' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}

export function DeleteCardio({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return <button type="button" aria-label="Kaydı sil" disabled={pending} className="w-11 h-11 flex items-center justify-center text-mute" onClick={() => start(async () => { const r = await deleteCardioAction(id); if (r.ok) router.refresh() })}><Trash size={18} /></button>
}
