'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DAY_START_OPTIONS, atTime } from '@/lib/time'
import { setDayStartAction } from '../actions'

/** Y1: gün sınırı seçimi — seçim anında kaydedilir. */
export default function DayStartPicker({ current }: { current: number }) {
  const [v, setV] = useState(current)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const pick = (min: number) => {
    const old = v
    setV(min); setMsg(null)
    start(async () => {
      const r = await setDayStartAction(min).catch(() => null)
      if (!r?.ok) { setV(old); setMsg(r && !r.ok ? r.error : 'Kaydedilemedi') } else { setMsg('Kaydedildi'); router.refresh() }
    })
  }
  const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
  return (
    <>
      <section className="card rounded-[22px] p-1.5 flex flex-col" role="radiogroup" aria-label="Günün bitişi" data-testid="day-start">
        {DAY_START_OPTIONS.map((o) => (
          <button key={o.min} type="button" role="radio" aria-checked={v === o.min} disabled={pending} onClick={() => pick(o.min)} data-day-start={o.min}
            className="min-h-[64px] px-3.5 rounded-[18px] flex items-center gap-3 text-left aria-checked:bg-[color-mix(in_oklab,var(--color-acc)_12%,var(--color-surface-2))]">
            <span className={`w-5 h-5 rounded-full border-2 shrink-0 ${v === o.min ? 'border-acc bg-acc shadow-[inset_0_0_0_3px_var(--color-surface)]' : 'border-line-2'}`} aria-hidden />
            <span className="flex flex-col flex-1 min-w-0 leading-tight gap-0.5"><b className="text-[15px] font-extrabold">{o.label}</b><span className="text-[12.5px] text-mute">{o.hint}</span></span>
          </button>
        ))}
      </section>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
      <section className="card rounded-[22px] p-4 flex flex-col gap-2 text-[13.5px] leading-relaxed text-ink-2">
        <b className="text-[14.5px] text-ink">Nasıl çalışır?</b>
        <p>Gün {v ? `gece ${atTime(v)}` : 'gece yarısında'} biter. {v ? `00.00 ile ${hh(v)} arasında eklediğin yemek, su ve antrenman dünün kaydına girer; kalori dengesi ve koç da dünü esas alır.` : 'Gece yarısından sonra eklediğin her şey yeni güne yazılır.'}</p>
        <p>Dünün hesabı yeni gün başladıktan 3 saat sonra kapanır. Daha önce girilmiş kayıtların yeri değişmez.</p>
      </section>
    </>
  )
}
