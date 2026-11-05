'use client'
import type { AnatomyView } from '@/lib/anatomy-data'

/**
 * Anatomi figürü (lisanslı görsel + bölgeler tek SVG'de; her ölçekte hizalı). `fills`: kas anahtarı → renk.
 * Renkler "multiply" ile basılır, kas dokusu görünür kalır. `onSelect` verilirse bölgeler dokunulabilir.
 */
export default function BodyFigure({ view, fills = {}, onSelect, crop, className = '', label }: {
  view: AnatomyView; fills?: Record<string, string>; onSelect?: (key: string) => void
  crop?: { x: number; y: number; w: number; h: number }; className?: string; label?: string
}) {
  const vb = crop ? `${crop.x} ${crop.y} ${crop.w} ${crop.h}` : `0 0 ${view.w} ${view.h}`
  return (
    <svg viewBox={vb} className={className} role={onSelect ? 'group' : 'img'} aria-label={label ?? 'Kas haritası'} preserveAspectRatio="xMidYMid meet" data-testid="body-figure" data-view={view.key}>
      <image href={view.image} x={0} y={0} width={view.w} height={view.h} />
      {view.areas.map((a, i) => {
        const fill = fills[a.key]
        if (!fill && !onSelect) return null
        return (
          <path key={i} d={a.d} fill={fill ?? 'transparent'} fillOpacity={fill ? 0.82 : 1}
            style={{ mixBlendMode: fill ? 'multiply' : undefined, cursor: onSelect ? 'pointer' : undefined, transition: 'fill 160ms' }}
            onClick={onSelect ? () => onSelect(a.key) : undefined} data-muscle={a.key} aria-hidden={!onSelect} />
        )
      })}
    </svg>
  )
}
