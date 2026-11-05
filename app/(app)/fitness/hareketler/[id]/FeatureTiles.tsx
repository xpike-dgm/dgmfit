'use client'
import { useState, type ReactNode } from 'react'

/** Seviye / ekipman / özellik kutuları; dokununca açıklaması altta açılır. */
export default function FeatureTiles({ tiles }: { tiles: { key: string; label: string; icon: ReactNode; desc: string | null }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const cur = tiles.find((t) => t.key === open)
  return (
    <div className="flex flex-col gap-2" data-testid="ex-tiles">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <button key={t.key} type="button" onClick={() => setOpen(open === t.key ? null : t.key)} aria-expanded={open === t.key} disabled={!t.desc}
            className={`aspect-[1.25] rounded-2xl border flex flex-col items-center justify-center gap-2 px-1.5 text-center transition ${open === t.key ? 'border-acc bg-acc/10' : 'border-line bg-surface-2'}`}>
            <span className="text-ink">{t.icon}</span>
            <span className="text-[12.5px] font-semibold leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
      {cur?.desc ? <p className="text-[13.5px] text-ink-2 leading-relaxed rounded-2xl bg-surface-2 p-3">{cur.desc}</p> : null}
    </div>
  )
}
