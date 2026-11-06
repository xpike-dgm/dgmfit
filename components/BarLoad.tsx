'use client'
/* eslint-disable @next/next/no-img-element */
import { platesFor } from '@/lib/training'
import type { PlateImages } from '@/lib/licensed'

// Faz 5h-6: bara takılacak plakalar — lisanslı bar/plaka görselleri (yoksa çizim). Plakalar önden görünüm, her taraf için soldan büyükten küçüğe.
const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')
const SIZE: Record<string, number> = { '25': 64, '20': 62, '15': 56, '10': 50, '5': 42, '2.5': 36, '1.25': 32 }
const COLOR: Record<string, string> = { '25': '#C62828', '20': '#1E3A8A', '15': '#F9A825', '10': '#2E7D32', '5': '#ECEFF1', '2.5': '#424242', '1.25': '#9E9E9E' }

export default function BarLoad({ total, bar, plates, images }: { total: number; bar: number; plates: number[]; images: PlateImages | null }) {
  const r = platesFor(total, bar, plates)
  const barImg = bar >= 20 ? images?.bar.olympic : images?.bar.half ?? images?.bar.olympic
  return (
    <div className="flex flex-col gap-2" data-testid="bar-load" data-plates={r.perSide.join(',')}>
      {barImg ? <img src={barImg} alt="" className="w-full h-auto opacity-90" aria-hidden /> : <span className="h-2 rounded-full bg-ink-2/60" aria-hidden />}
      <div className="flex items-end justify-center gap-1.5 min-h-[72px] flex-wrap" aria-label={r.perSide.length ? `Her tarafa ${r.perSide.map(fmt).join(' + ')} kg` : 'Yalnızca bar'}>
        {r.perSide.length ? r.perSide.map((p, i) => {
          const k = String(p), s = SIZE[k] ?? Math.max(28, Math.min(64, 26 + p * 1.5)), img = images?.plates[k]
          return (
            <span key={i} className="flex flex-col items-center gap-0.5" data-testid="plate">
              {img ? <img src={img} alt="" width={s} height={s} style={{ width: s, height: s }} /> : <span className="rounded-full border-4 border-black/20" style={{ width: s, height: s, background: COLOR[k] ?? '#607D8B' }} />}
              <span className="num text-[11px] font-bold text-ink-2">{fmt(p)}</span>
            </span>
          )
        }) : <span className="text-[13px] text-mute self-center">Yalnızca bar</span>}
      </div>
      <p className="text-[12.5px] text-mute text-center">{r.perSide.length ? 'Her tarafa' : ''} {r.perSide.length ? <b className="num text-ink">{r.perSide.map(fmt).join(' + ')} kg</b> : null} · bar {fmt(bar)} kg{r.remainder ? <span className="text-orange"> · tam {fmt(total)} olmuyor, en yakın {fmt(r.achieved)}</span> : null}</p>
    </div>
  )
}
