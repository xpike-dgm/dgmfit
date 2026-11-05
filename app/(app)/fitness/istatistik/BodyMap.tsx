'use client'
import { useState } from 'react'
import { MUSCLES } from '@/lib/exercise-labels'
import { BODY_MAP, type BodyView } from '@/lib/body-map-paths'

type Heat = { muscle: string; sets: number; status: 'yeşil' | 'sarı' | 'kırmızı' }
const RING = { 'yeşil': 'var(--color-good)', 'sarı': 'var(--color-orange)', 'kırmızı': 'var(--color-danger)' }
const STATUS_T = { 'yeşil': 'Hazır', 'sarı': 'Toparlanıyor', 'kırmızı': 'Dinlendir' }
// Son 7 gündeki set sayısına göre yoğunluk (0 = boyanmaz)
const level = (sets: number) => (sets <= 0 ? 0 : sets < 4 ? 0.35 : sets < 8 ? 0.62 : sets < 12 ? 0.82 : 1)

function Figure({ view, label, heat, sel, onSel }: { view: BodyView; label: string; heat: Map<string, Heat>; sel: string | null; onSel: (k: string) => void }) {
  return (
    <figure className="flex-1 flex flex-col items-center gap-1 min-w-0">
      <svg viewBox={`0 0 ${view.w} ${view.h}`} className="w-full max-w-[170px] h-auto" role="group" aria-label={label}>
        <path d={view.outline} fill="var(--color-surface-3)" />
        {Object.entries(view.muscles).map(([k, d]) => {
          const h = heat.get(k), lv = level(h?.sets ?? 0)
          return (
            <path key={k} d={d} role="button" tabIndex={0} aria-label={`${MUSCLES[k] ?? k}: ${h?.sets ?? 0} set`} aria-pressed={sel === k}
              onClick={() => onSel(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(k) } }}
              fill={lv ? 'var(--color-acc)' : 'var(--color-line-2)'} fillOpacity={lv || 0.55}
              stroke={sel === k ? 'var(--color-ink)' : 'var(--color-surface)'} strokeWidth={sel === k ? 2.2 : 1.2} strokeLinejoin="round"
              className="cursor-pointer outline-none transition-[fill-opacity] focus-visible:stroke-[var(--color-ink)]" />
          )
        })}
      </svg>
      <figcaption className="text-[11px] text-mute">{label}</figcaption>
    </figure>
  )
}

/** Son 7 günde kas grubu başına set (yoğunluk) ve dokununca toparlanma durumu. Yollar data/body-map-source.webp'den üretilir. */
export default function BodyMap({ heat }: { heat: Heat[] }) {
  const m = new Map(heat.map((h) => [h.muscle, h]))
  const top = [...heat].filter((h) => h.sets > 0).sort((a, b) => b.sets - a.sets)[0]?.muscle ?? null
  const [sel, setSel] = useState<string | null>(top)
  const cur = sel ? m.get(sel) : undefined
  return (
    <div className="flex flex-col gap-3" data-testid="body-map">
      <div className="flex gap-3 justify-center">
        <Figure view={BODY_MAP.front} label="Ön" heat={m} sel={sel} onSel={setSel} />
        <Figure view={BODY_MAP.back} label="Arka" heat={m} sel={sel} onSel={setSel} />
      </div>
      <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5 flex items-center justify-between gap-3 min-h-12" aria-live="polite">
        {sel ? (
          <>
            <span className="font-bold text-[14px]">{MUSCLES[sel] ?? sel}</span>
            <span className="flex items-center gap-2 text-[13px]">
              <b className="num">{cur?.sets ? `${cur.sets} set` : 'Çalışılmadı'}</b>
              {cur?.sets ? <span className="flex items-center gap-1 text-ink-2"><span className="w-2 h-2 rounded-full" style={{ background: RING[cur.status] }} />{STATUS_T[cur.status]}</span> : null}
            </span>
          </>
        ) : <span className="text-[13px] text-mute">Bir kasa dokun: son 7 günde kaç set çalıştığını ve toparlanmasını gör.</span>}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-mute" aria-hidden>
        <span>Az</span>
        {[0.35, 0.62, 0.82, 1].map((o) => <span key={o} className="w-6 h-2.5 rounded-sm bg-acc" style={{ opacity: o }} />)}
        <span>Çok set</span>
      </div>
    </div>
  )
}
