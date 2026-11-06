'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAdvancedAction } from '../actions'

/** Sade / Gelişmiş mod anahtarı. */
export default function AdvancedToggle({ on }: { on: boolean }) {
  const [v, setV] = useState(on)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <section className="card p-4 flex flex-col gap-2" aria-label="Gelişmiş mod">
      <label htmlFor="ui-advanced" className="flex items-center justify-between gap-3 min-h-11 cursor-pointer">
        <span className="flex flex-col">
          <b className="text-[15px]">Gelişmiş mod</b>
          <span className="text-[13px] text-mute">{v ? 'İleri araçlar ve ayrıntılar açık' : 'Sade görünüm'}</span>
        </span>
        <input id="ui-advanced" type="checkbox" role="switch" checked={v} disabled={pending} data-testid="ui-advanced"
          onChange={(e) => { const n = e.target.checked; setV(n); start(async () => { const r = await setAdvancedAction(n).catch(() => null); if (!r?.ok) setV(!n); router.refresh() }) }}
          className="appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
      </label>
      <p className="text-[12.5px] text-mute leading-snug">Periyodizasyon, GZCLP, MSS yükü, kalori bankası, check-in, senaryo, karb döngüsü, AI menü gibi araçlar.</p>
    </section>
  )
}
