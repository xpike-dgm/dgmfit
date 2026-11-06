'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** Açıklama cümlesi yerine küçük "i": dokununca açılır, dışarı dokununca/kaydırınca kapanır (sadeleştirme 2026-11-06).
 *  Kutu ekranın içinde kalacak şekilde simgenin altına (yer yoksa üstüne) sabit konumla yerleşir. */
export default function InfoTip({ children, label = 'Açıklama', className = '' }: { children: ReactNode; label?: string; className?: string }) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null)
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const off = (e: Event) => { if (!btn.current?.contains(e.target as Node) && !box.current?.contains(e.target as Node)) close() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc); window.addEventListener('scroll', close, { passive: true })
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', close) }
  }, [pos])
  const toggle = () => {
    if (pos) { setPos(null); return }
    const r = btn.current!.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight
    const width = Math.min(300, vw - 24)
    const left = Math.max(12, Math.min(vw - width - 12, r.left + r.width / 2 - width / 2))
    setPos(r.bottom + 180 > vh ? { left, bottom: vh - r.top + 6, width } : { left, top: r.bottom + 6, width })
  }
  return (
    <span className={`inline-flex align-middle ${className}`}>
      <button ref={btn} type="button" aria-label={label} aria-expanded={!!pos} aria-controls={id} onClick={toggle} data-testid="info-tip"
        className="w-[18px] h-[18px] rounded-full border border-current text-mute text-[11px] font-extrabold leading-none inline-flex items-center justify-center normal-case tracking-normal shrink-0">i</button>
      {pos ? (
        <span ref={box} id={id} role="note" style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="z-50 rounded-2xl bg-surface-3 border border-line-2 shadow-lg px-3.5 py-3 text-[13px] font-normal normal-case tracking-normal text-ink-2 leading-relaxed text-left">
          {children}
        </span>
      ) : null}
    </span>
  )
}
