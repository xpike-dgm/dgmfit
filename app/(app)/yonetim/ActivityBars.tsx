'use client'
import { useState } from 'react'

/** Son 14 günde su/öğün/antrenman kaydı giren kişi sayısı (tek seri): dokununca o günün değeri yazılır. */
export default function ActivityBars({ days }: { days: { day: string; active: number; signups: number }[] }) {
  const [sel, setSel] = useState(days.length - 1)
  const max = Math.max(1, ...days.map((d) => d.active))
  const fmt = (d: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00Z'))
  const s = days[sel]
  return (
    <div className="rounded-2xl bg-white/[0.14] p-3 mt-3" data-testid="activity-chart">
      <div className="flex items-baseline justify-between gap-2 text-[12.5px] font-semibold">
        <span className="opacity-90">Takip kaydı giren · 14 gün</span>
        <span className="num whitespace-nowrap"><b className="text-[15px]">{s.active}</b> kişi · {fmt(s.day)}{s.signups ? ` · ${s.signups} yeni üye` : ''}</span>
      </div>
      <div className="flex items-end gap-[2px] h-[64px] mt-2" role="img" aria-label={`Son 14 günde günlük takip kaydı giren kişi: ${days.map((d) => d.active).join(', ')}`}>
        {days.map((d, i) => (
          <button key={d.day} type="button" onClick={() => setSel(i)} aria-label={`${fmt(d.day)}: ${d.active} kişi`} className="flex-1 h-full flex items-end min-w-0">
            <span className="w-full rounded-t-[4px] transition-[height] duration-500" style={{ height: `${Math.max(3, (d.active / max) * 100)}%`, background: i === sel ? '#fff' : 'rgba(255,255,255,0.45)' }} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] opacity-80 mt-1 num"><span>{fmt(days[0].day)}</span><span>bugün</span></div>
    </div>
  )
}
