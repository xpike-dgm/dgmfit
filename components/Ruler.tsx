'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  /** Kaç adımda bir büyük çizgi + etiket */
  majorEvery: number
  labelEvery?: number
  band?: [number, number]
  label: string
  format?: (v: number) => string
}

const PX = 10 // adım başına piksel

export default function Ruler({ min, max, step, value, onChange, majorEvery, labelEvery = majorEvery, band, label, format = String }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [half, setHalf] = useState(175)
  const programmatic = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const steps = Math.round((max - min) / step)
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step)), [min, max, step])
  const toX = useCallback((v: number) => ((v - min) / step) * PX, [min, step])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHalf(el.clientWidth / 2)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    programmatic.current = true
    el.scrollLeft = toX(value)
    requestAnimationFrame(() => { programmatic.current = false })
    // yalnızca ilk yüklemede
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dışarıdan değişen değeri (± butonları, klavye) cetvele yansıt
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = toX(value)
    if (Math.abs(el.scrollLeft - target) > PX / 2) {
      programmatic.current = true
      el.scrollTo({ left: target, behavior: 'smooth' })
      setTimeout(() => { programmatic.current = false }, 350)
    }
  }, [value, toX])

  const onScroll = () => {
    const el = ref.current
    if (!el || programmatic.current) return
    const v = clamp(min + Math.round(el.scrollLeft / PX) * step)
    const fixed = Number(v.toFixed(4))
    if (fixed !== value) {
      onChange(fixed)
      if (navigator.vibrate && Math.round((fixed - min) / step) % majorEvery === 0) navigator.vibrate(4)
    }
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const snap = Math.round(el.scrollLeft / PX) * PX
      if (Math.abs(snap - el.scrollLeft) > 0.5) el.scrollTo({ left: snap, behavior: 'smooth' })
    }, 120)
  }

  const onKey = (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? majorEvery : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Number(clamp(value + step * big).toFixed(4))) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Number(clamp(value - step * big).toFixed(4))) }
  }

  const labels: number[] = []
  for (let i = 0; i <= steps; i += labelEvery) labels.push(Number((min + i * step).toFixed(4)))

  const ticks = `repeating-linear-gradient(90deg, var(--color-faint) 0 2px, transparent 2px ${PX * majorEvery}px),
    repeating-linear-gradient(90deg, var(--color-line-2) 0 2px, transparent 2px ${PX}px)`

  return (
    <div className="relative select-none">
      <div
        ref={ref}
        onScroll={onScroll}
        onKeyDown={onKey}
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        className="no-scrollbar overflow-x-auto rounded-[22px] bg-[#121410] h-[120px] outline-none focus-visible:ring-2 focus-visible:ring-lime"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="relative h-full" style={{ width: steps * PX + half * 2 }}>
          <div className="absolute inset-y-0" style={{ left: half, width: steps * PX + 2 }}>
            {band ? (
              <div className="absolute inset-y-0 bg-lime/[0.08]"
                style={{ left: Math.max(0, toX(band[0])), width: Math.max(0, Math.min(toX(max), toX(band[1])) - Math.max(0, toX(band[0]))) }} />
            ) : null}
            <div className="absolute left-0 right-0 top-[22px]" style={{ height: 24, background: ticks, backgroundPosition: '-1px 0' }} />
            <div className="absolute left-0 right-0 top-[22px]" style={{ height: 44, background: `repeating-linear-gradient(90deg, var(--color-faint) 0 2px, transparent 2px ${PX * majorEvery}px)`, backgroundPosition: '-1px 0', opacity: 0.9 }} />
            {labels.map((l) => (
              <span key={l} className="absolute top-[78px] w-12 -ml-6 text-center num text-[13px] text-mute" style={{ left: toX(l) }}>{format(l)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[10px] w-[3px] h-[64px] rounded bg-lime" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 rounded-l-[22px] bg-gradient-to-r from-[#121410] to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 rounded-r-[22px] bg-gradient-to-l from-[#121410] to-transparent" aria-hidden />
    </div>
  )
}
