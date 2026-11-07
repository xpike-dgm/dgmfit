'use client'
// Ö6: kütüphanede "Kullan" (haftanın şablonu) ve "Kullan'a basınca" tercihi (bu cihazda saklanır).
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { templateAction } from '../actions'

type Mode = 'all' | 'colors' | 'layout'
const KEY = 'dgfit:tpl-use-mode'
const read = (): Mode => { try { const v = localStorage.getItem(KEY); return v === 'colors' || v === 'layout' ? v : 'all' } catch { return 'all' } }

export function UseButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      <button type="button" disabled={pending} data-testid="hero-use"
        onClick={() => start(async () => { const r = await templateAction({ id, op: 'use', mode: read() }).catch(() => null); if (r?.ok) { router.push('/'); router.refresh() } else setErr(r && !r.ok ? r.error : 'Olmadı') })}
        className="flex-1 min-h-11 rounded-full bg-acc text-acc-ink font-extrabold text-[14px] disabled:opacity-60">{pending ? '…' : 'Kullan'}</button>
      {err ? <span role="alert" className="sr-only">{err}</span> : null}
    </>
  )
}

export function UseModeBox() {
  const [m, setM] = useState<Mode>('all')
  useEffect(() => setM(read()), [])
  const pick = (v: Mode) => { setM(v); try { localStorage.setItem(KEY, v) } catch { /* özel pencere */ } }
  return (
    <section aria-label="Kullan'a basınca" className="rounded-[20px] p-3.5 flex flex-col gap-2.5 bg-coach border border-coach-line" data-testid="use-mode">
      <b className="text-[14px] font-extrabold">“Kullan”a basınca</b>
      <div role="radiogroup" aria-label="Kullan'a basınca" className="grid grid-cols-3 gap-2">
        {([['all', 'Hepsi'], ['colors', 'Yalnız renk'], ['layout', 'Yalnız düzen']] as const).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={m === v} onClick={() => pick(v)}
            className="min-h-11 rounded-[12px] text-[13px] font-bold border border-coach-line aria-checked:bg-acc aria-checked:text-acc-ink aria-checked:border-acc">{l}</button>
        ))}
      </div>
      <span className="text-[12.5px] text-ink-2 leading-relaxed">Önizlemede senin verilerin görünür; beğenmezsen Tasarımlarım’dan tek dokunuşla eski tasarımına dönersin.</span>
    </section>
  )
}
