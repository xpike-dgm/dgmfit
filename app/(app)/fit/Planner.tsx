'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { fmtNum, type GoalType } from '@/lib/calc'
import { CARDIO, type CardioType } from '@/lib/training'
import { CARB_SHIFT, carbCycleDay, simulate } from '@/lib/scenario'
import { saveCarbCycleAction } from './actions'

const trDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "Haftada 2 gün daha koşarsam hedefe ne zaman ulaşırım?" — hesap tamamen cihazda, lib/scenario.ts ile. */
export function Scenario(p: { goal: GoalType; currentKg: number; targetKg: number; tdee: number; tdeeMeasured: boolean; dailyKcal: number; floor: number; today: string; endDate: string }) {
  const [type, setType] = useState<CardioType>('run')
  const [minutes, setMinutes] = useState(30)
  const [perWeek, setPerWeek] = useState(0)
  const [delta, setDelta] = useState(0)
  const base = useMemo(() => simulate({ ...p }), [p])
  const s = useMemo(() => simulate({ ...p, extra: { type, minutes, perWeek }, kcalDelta: delta }), [p, type, minutes, perWeek, delta])
  return (
    <section aria-label="Senaryo simülatörü" className="card p-5 flex flex-col gap-3" data-testid="scenario">
      <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-mute">Senaryo simülatörü</span>
      <p className="text-[12px] text-mute">Harcama {p.tdeeMeasured ? 'ölçülen (adaptif)' : 'plandaki'} {fmtNum(p.tdee)} kcal; 1 kg ≈ 7.700 kcal. Tahmindir, vücut zamanla uyum sağlar.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-semibold">Ek kardiyo
          <select value={type} onChange={(e) => setType(e.target.value as CardioType)} className="h-11 rounded-xl bg-surface-2 border border-line px-2 font-normal text-[14px]">{Object.entries(CARDIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </label>
        <label htmlFor="sc-week" className="flex flex-col gap-1 text-[12px] font-semibold">Haftada <b className="num">{perWeek} gün</b>
          <input id="sc-week" type="range" min={0} max={7} value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} className=" h-11" />
        </label>
        <label htmlFor="sc-min" className="flex flex-col gap-1 text-[12px] font-semibold">Seans <b className="num">{minutes} dk</b>
          <input id="sc-min" type="range" min={10} max={120} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className=" h-11" />
        </label>
        <label htmlFor="sc-kcal" className="flex flex-col gap-1 text-[12px] font-semibold">Günlük kalori <b className="num">{delta > 0 ? '+' : ''}{delta} kcal</b>
          <input id="sc-kcal" type="range" min={-500} max={500} step={50} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className=" h-11" />
        </label>
      </div>
      <div className="rounded-2xl bg-surface-2 px-4 py-3 flex flex-col gap-1 text-[14px]" data-testid="scenario-out">
        <span>Tempo: <b className="num">{fmtNum(Math.abs(s.kgPerWeek), 2)} kg/hafta</b> {s.kgPerWeek < 0 ? 'kayıp' : s.kgPerWeek > 0 ? 'artış' : ''} <span className="text-mute">(şimdi {fmtNum(Math.abs(base.kgPerWeek), 2)})</span></span>
        {s.extraBurnPerDay ? <span className="text-[13px] text-ink-2">Ek egzersiz günde ortalama {fmtNum(s.extraBurnPerDay)} kcal</span> : null}
        <span>Tahmini varış: <b data-testid="scenario-date">{s.date ? trDate(s.date) : 'bu senaryoyla hedefe gidilmiyor'}</b>{s.date && base.date && s.date !== base.date ? <span className="text-mute"> · şu ana göre {Math.abs(Math.round((Date.parse(base.date) - Date.parse(s.date)) / 86400000))} gün {s.date < base.date ? 'erken' : 'geç'}</span> : null}</span>
        <span className="text-[12px] text-mute">Plandaki hedef tarih: {trDate(p.endDate)}</span>
        {s.warnings.map((w, i) => <span key={i} className="text-[13px] text-orange">{w}</span>)}
      </div>
    </section>
  )
}

const WD = [['1', 'Pzt'], ['2', 'Sal'], ['3', 'Çar'], ['4', 'Per'], ['5', 'Cum'], ['6', 'Cmt'], ['0', 'Paz']] as const

export function CarbCycle(p: { enabled: boolean; weekdays: number[]; shiftG: number; base: { kcal: number; protein: number; carb: number; fat: number } }) {
  const [v, setV] = useState({ enabled: p.enabled, weekdays: p.weekdays, shiftG: p.shiftG })
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const n = v.weekdays.length
  const t = carbCycleDay(p.base, true, n, v.shiftG), r = carbCycleDay(p.base, false, n, v.shiftG)
  return (
    <section aria-label="Karb döngüsü" className="card p-5 flex flex-col gap-3" data-testid="carb-cycle">
      <label className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-mute">Karb döngüsü</span>
        <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="w-5 h-5 my-[11px]" aria-label="Karb döngüsünü aç" />
      </label>
      <p className="text-[12px] text-mute">Antrenman günlerinde karbonhidrat artar, dinlenme günlerinde azalır; haftalık toplam ve protein aynı kalır.</p>
      {v.enabled ? (
        <>
          <div className="flex gap-1.5" role="group" aria-label="Antrenman günleri">{WD.map(([k, l]) => { const d = Number(k); const on = v.weekdays.includes(d); return (
            <button key={k} type="button" aria-pressed={on} onClick={() => setV({ ...v, weekdays: on ? v.weekdays.filter((x) => x !== d) : [...v.weekdays, d] })} className={`flex-1 h-10 rounded-xl text-[12px] font-bold ${on ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{l}</button>
          ) })}</div>
          <label htmlFor="cc-shift" className="flex flex-col gap-1 text-[13px] font-semibold">Antrenman günü ek karbonhidrat <b className="num">{v.shiftG} g</b>
            <input id="cc-shift" type="range" min={CARB_SHIFT.min} max={CARB_SHIFT.max} step={5} value={v.shiftG} onChange={(e) => setV({ ...v, shiftG: Number(e.target.value) })} className=" h-10" />
          </label>
          {n > 0 && n < 7 ? <p className="text-[13px] text-ink-2" data-testid="carb-preview">Antrenman günü <b className="num">{t.carb} g</b> karbonhidrat ({fmtNum(t.kcal)} kcal) · dinlenme günü <b className="num">{r.carb} g</b> ({fmtNum(r.kcal)} kcal)</p> : <p className="text-[13px] text-orange">1–6 antrenman günü seç.</p>}
        </>
      ) : null}
      {msg ? <p role="status" className="text-[13px] text-acc">{msg}</p> : null}
      <button type="button" className={btn.secondary} disabled={pending || (v.enabled && (n === 0 || n === 7))} onClick={() => start(async () => { const x = await saveCarbCycleAction(v); setMsg(x.ok ? 'Kaydedildi; açık günlerin hedefleri güncellendi.' : x.error); router.refresh() })}>Döngüyü uygula</button>
    </section>
  )
}
