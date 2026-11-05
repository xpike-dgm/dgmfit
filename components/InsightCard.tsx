'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Spark } from './icons'
import { dismissInsightAction } from '@/app/(app)/koc/actions'

type Insight = { id: string; key: string; tone: 'good' | 'warn' | 'info' | 'care'; title: string; body: string; ask: string | null; provider: string | null }

/** Bugün ekranındaki tek koç kartı: günün içgörüsü (günde en fazla 1) ya da güvenlik destek kartı. */
export default function InsightCard({ fallback, weeklyReady }: { fallback: string; weeklyReady: boolean }) {
  const [ins, setIns] = useState<Insight | null | undefined>(undefined)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let live = true
    fetch('/api/coach/insight', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (live) setIns(j.insight ?? null) }).catch(() => { if (live) setIns(null) })
    return () => { live = false }
  }, [])
  const care = ins?.tone === 'care'
  return (
    <section aria-label="Koç" data-testid="coach-card" className={`rounded-[28px] px-5 py-[18px] flex flex-col gap-3 border ${care ? 'bg-surface border-water/40' : 'bg-coach border-coach-line'}`}>
      <div className="flex items-center gap-2">
        <Spark size={18} className={care ? 'text-water' : 'text-lime'} />
        <span className={`text-[13px] font-bold tracking-[0.08em] uppercase ${care ? 'text-water' : 'text-lime'}`}>Koç</span>
        {ins && !hidden && !care ? <button type="button" className="ml-auto text-[12px] text-mute font-semibold h-8 px-2" onClick={() => { setHidden(true); void dismissInsightAction(ins.id) }}>Kapat</button> : null}
      </div>
      {ins === undefined ? <p className="text-[15px] leading-relaxed text-[#E4E8DC] opacity-70" aria-busy="true">{fallback}</p>
        : ins && !hidden ? (
          <div className="flex flex-col gap-1" data-testid="insight" data-key={ins.key}>
            <span className="font-bold text-[15px]">{ins.title}</span>
            <p className="text-[15px] leading-relaxed text-[#E4E8DC]">{ins.body}</p>
          </div>
        ) : <p className="text-[15px] leading-relaxed text-[#E4E8DC]">{fallback}</p>}
      <div className="flex flex-wrap gap-2">
        <Link href={ins?.ask && !hidden ? `/koc?soru=${encodeURIComponent(ins.ask)}` : '/koc'} className="h-10 px-4 rounded-full bg-lime text-lime-ink font-bold text-[14px] inline-flex items-center">{ins?.ask && !hidden ? 'Koça sor' : 'Koçla konuş'}</Link>
        {weeklyReady ? <Link href="/rapor" className="h-10 px-4 rounded-full border border-coach-line text-ink font-bold text-[14px] inline-flex items-center" data-testid="weekly-link">Haftalık rapor</Link> : null}
      </div>
    </section>
  )
}
