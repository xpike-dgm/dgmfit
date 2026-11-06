'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { btn } from '@/components/ui'
import { navyBodyFat } from '@/lib/body-comp'
import { fmtNum } from '@/lib/calc'
import { saveBodyFatAction } from '../actions'

const input = 'w-full h-12 rounded-2xl bg-surface-2 border border-line px-4 text-[16px] num outline-none focus:border-acc'
const n = (s: string) => { const v = Number(s.replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null }

export default function BodyFatForm({ sex, heightCm, last }: { sex: 'male' | 'female'; heightCm: number; last: { neck: number | null; waist: number | null; hips: number | null } }) {
  const router = useRouter()
  const [mode, setMode] = useState<'measure' | 'know'>('measure')
  const [v, setV] = useState({ neck: last.neck ? String(last.neck) : '', waist: last.waist ? String(last.waist) : '', hips: last.hips ? String(last.hips) : '', pct: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const navy = n(v.neck) && n(v.waist) ? navyBodyFat(sex, heightCm, n(v.neck)!, n(v.waist)!, n(v.hips)) : null
  const save = () => start(async () => {
    const r = mode === 'know' ? await saveBodyFatAction({ pct: n(v.pct) }) : await saveBodyFatAction({ neck: n(v.neck), waist: n(v.waist), hips: n(v.hips) })
    setMsg(r.ok ? `Kaydedildi: %${fmtNum(r.bf!, 1)}. Protein ve makrolar güncellendi.` : r.error ?? 'Olmadı')
    if (r.ok) router.refresh()
  })
  return (
    <section className="card p-4 flex flex-col gap-3" data-testid="bodyfat-form">
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-surface-2" role="group" aria-label="Yöntem">
        {([['measure', 'Ölçülerimden hesapla'], ['know', 'Biliyorum']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`h-10 rounded-full text-[13px] font-bold ${mode === k ? 'bg-ink text-bg' : 'text-mute'}`}>{l}</button>
        ))}
      </div>
      {mode === 'measure' ? (
        <>
          <div className={`grid ${sex === 'female' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            <label className="flex flex-col gap-1 text-xs text-mute">Boyun (cm)<input id="bf-neck" inputMode="decimal" className={input} value={v.neck} onChange={(e) => setV({ ...v, neck: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-xs text-mute">Bel (cm)<input id="bf-waist" inputMode="decimal" className={input} value={v.waist} onChange={(e) => setV({ ...v, waist: e.target.value })} /></label>
            {sex === 'female' ? <label className="flex flex-col gap-1 text-xs text-mute">Kalça (cm)<input id="bf-hips" inputMode="decimal" className={input} value={v.hips} onChange={(e) => setV({ ...v, hips: e.target.value })} /></label> : null}
          </div>
          <p className="text-[13px] text-ink-2" data-testid="bf-preview">{navy !== null ? <>Hesaplanan: <b className="num">%{fmtNum(navy, 1)}</b> (ABD Donanması formülü, boy {heightCm} cm)</> : 'Ölçüleri gir, sonucu hemen görürsün.'}</p>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-mute">Yağ oranı (%)<input id="bf-pct" inputMode="decimal" className={input} value={v.pct} onChange={(e) => setV({ ...v, pct: e.target.value })} placeholder="Ör. 18" /></label>
      )}
      <button type="button" disabled={pending || (mode === 'measure' ? navy === null : !n(v.pct))} className={btn.primary + ' h-12 text-[15px]'} onClick={save}>Kaydet</button>
      {msg ? <p role="status" className="text-[13px] font-semibold">{msg}</p> : null}
    </section>
  )
}
