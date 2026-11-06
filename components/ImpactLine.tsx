'use client'
import { useEffect, useState } from 'react'
import { fmtNum } from '@/lib/calc'

/** Faz 7-2: bir kayıttan sonra günün durumu tek satırda (kalan kcal · protein · su). `n` değişince yenilenir. */
export default function ImpactLine({ n }: { n: number }) {
  const [s, setS] = useState<{ kcalLeft: number; proteinPct: number; waterPct: number } | null>(null)
  useEffect(() => {
    if (!n) return
    const c = new AbortController()
    fetch('/api/today/state', { signal: c.signal }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setS(j)).catch(() => {})
    return () => c.abort()
  }, [n])
  if (!s) return null
  return (
    <span className="text-[12.5px] text-ink-2 num" data-testid="impact-line">
      {s.kcalLeft >= 0 ? `Kalan ${fmtNum(s.kcalLeft)} kcal` : `${fmtNum(-s.kcalLeft)} kcal aşım`} · protein %{s.proteinPct} · su %{s.waterPct}
    </span>
  )
}
