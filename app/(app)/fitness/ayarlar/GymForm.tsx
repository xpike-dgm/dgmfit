'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { EQUIPMENT } from '@/lib/exercise-labels'
import { ALL_EQUIPMENT } from '@/lib/programs'
import { updateGymAction } from '../actions'

const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5]

export type GymPart = 'equipment' | 'plates' | 'increment' | 'session'

export default function GymForm({ initial, part }: { initial: { barKg: number; increment: number; plates: number[]; equipment: string[]; sessionMinutes: number }; part: GymPart }) {
  const [v, setV] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const toggle = <T,>(arr: T[], x: T) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x])
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateGymAction(v as never); setMsg(r.ok ? { ok: true, t: 'Kaydedildi.' } : { ok: false, t: r.error }); if (r.ok) router.refresh() }) }}>
      {part === 'plates' ? (
        <section className="card p-5 flex flex-col gap-3">
          <fieldset className="flex gap-1.5"><legend className="text-sm font-semibold mb-1.5">Bar ağırlığı</legend>
            {[20, 15, 10, 0].map((b) => <button key={b} type="button" aria-pressed={v.barKg === b} onClick={() => setV({ ...v, barKg: b })} className={`flex-1 h-11 rounded-xl font-bold num ${v.barKg === b ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{b ? `${b} kg` : 'Yok'}</button>)}
          </fieldset>
          <Eyebrow>Salondaki plakalar</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PLATES.map((pl) => <button key={pl} type="button" aria-pressed={v.plates.includes(pl)} onClick={() => setV({ ...v, plates: toggle(v.plates, pl) })} className={`h-10 px-3 rounded-full num text-[13px] font-bold ${v.plates.includes(pl) ? 'bg-acc text-acc-ink' : 'bg-surface-2 text-ink-2'}`}>{String(pl).replace('.', ',')}</button>)}
          </div>
        </section>
      ) : null}
      {part === 'increment' ? (
        <section className="card p-5 flex flex-col gap-3">
          <fieldset className="flex gap-1.5"><legend className="text-sm font-semibold mb-1.5">En küçük ağırlık artışı (iki taraf toplamı)</legend>
            {[1, 2, 2.5, 5].map((b) => <button key={b} type="button" aria-pressed={v.increment === b} onClick={() => setV({ ...v, increment: b })} className={`flex-1 h-11 rounded-xl font-bold num ${v.increment === b ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{String(b).replace('.', ',')} kg</button>)}
          </fieldset>
          <p className="text-[13px] text-mute leading-relaxed">Öneri motoru bir sonraki ağırlığı bu adımla yuvarlar ve plakalarınla kurulabilir olmasını kontrol eder.</p>
        </section>
      ) : null}
      {part === 'equipment' ? (
        <section className="card p-5 flex flex-col gap-2">
          <Eyebrow>Mevcut ekipman</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EQUIPMENT.map((k) => <button key={k} type="button" aria-pressed={v.equipment.includes(k)} onClick={() => setV({ ...v, equipment: toggle(v.equipment, k) })} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${v.equipment.includes(k) ? 'bg-acc text-acc-ink' : 'bg-surface-2 text-ink-2'}`}>{EQUIPMENT[k] ?? k}</button>)}
          </div>
        </section>
      ) : null}
      {part === 'session' ? (
        <section className="card p-5 flex flex-col gap-2">
          <label htmlFor="gym-min" className="flex flex-col gap-1.5 text-sm font-semibold"><span className="flex justify-between">Seans süresi <b className="num">{v.sessionMinutes} dk</b></span>
            <input id="gym-min" type="range" min={20} max={120} step={5} value={v.sessionMinutes} onChange={(e) => setV({ ...v, sessionMinutes: Number(e.target.value) })} className="h-8" />
          </label>
          <p className="text-[13px] text-mute leading-relaxed">Program oluşturucu hareket ve set sayısını bu süreye sığdırır.</p>
        </section>
      ) : null}
      <button type="submit" className={btn.primary} disabled={pending || !v.plates.length || !v.equipment.length}>Kaydet</button>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-acc' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}
