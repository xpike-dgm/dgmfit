'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
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
      <label htmlFor="c-type" className="flex flex-col gap-1.5 text-[13px] font-semibold">Aktivite
        <select id="c-type" value={type} onChange={(e) => setType(e.target.value)} className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-[15px] text-ink font-semibold">
          {types.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <div className={`grid ${t.distance ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        <label htmlFor="c-min" className="flex flex-col gap-1 text-[13px] font-semibold">Süre
          <span className="relative"><input id="c-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-line pl-3 pr-10 num text-lg text-ink" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-mute text-[13px]">dk</span></span>
        </label>
        {t.distance ? <label htmlFor="c-km" className="flex flex-col gap-1 text-[13px] font-semibold">Mesafe
          <span className="relative"><input id="c-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="isteğe bağlı" className="w-full h-12 rounded-xl bg-surface-2 border border-line pl-3 pr-10 num text-lg text-ink placeholder:text-[13px]" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-mute text-[13px]">km</span></span>
        </label> : null}
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-semibold mb-1.5">Ne kadar zorladı?</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {([['hafif', 'Hafif', 'Rahat konuşurum'], ['orta', 'Orta', 'Cümle kurarım'], ['yoğun', 'Yoğun', 'Zor konuşurum']] as const).map(([k, l, h]) => (
            <button key={k} type="button" aria-pressed={intensity === k} onClick={() => setIntensity(k)} className={`min-h-14 rounded-xl px-2 py-1.5 flex flex-col items-center justify-center ${intensity === k ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>
              <b className="text-[14px]">{l}</b><span className="text-[10.5px] opacity-80">{h}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <details className="rounded-xl border border-line">
        <summary className="list-none cursor-pointer flex items-center justify-between min-h-12 px-3 text-[13px] font-semibold">Nabız (isteğe bağlı) <span className="text-mute font-normal">{hr ? `${hr} atım/dk` : 'Saat ya da bant varsa'} ▾</span></summary>
        <label htmlFor="c-hr" className="flex flex-col gap-1 px-3 pb-3 text-[13px] font-semibold">Ortalama nabız
          <input id="c-hr" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="ör. 145" className="h-12 rounded-xl bg-surface-2 border border-line px-3 num text-ink" />
        </label>
      </details>
      <details className="text-[12px] text-mute leading-relaxed">
        <summary className="cursor-pointer font-semibold">Kalori nasıl hesaplanıyor?</summary>
        <p className="mt-1">Nabız girersen nabız formülü (Keytel), koşu/yürüyüşte mesafe girersen hız denklemi (ACSM), yoksa aktivite tablosu (MET) kullanılır. Fit'e dinlenme harcaması düşülmüş net kalori eklenir.</p>
      </details>
      <button type="submit" className={btn.primary} disabled={pending}>Kaydet</button>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-acc' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}

export function DeleteCardio({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return <button type="button" aria-label="Kaydı sil" disabled={pending} className="w-11 h-11 flex items-center justify-center text-mute" onClick={() => start(async () => { const r = await deleteCardioAction(id); if (r.ok) router.refresh() })}><Trash size={18} /></button>
}
