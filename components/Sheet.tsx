'use client'
import { useEffect, useRef, type ReactNode, type PointerEvent as RPE } from 'react'
import { Close } from './icons'

/**
 * Alttan açılan pencere davranışı: tutamaçtan (ya da başlıktan) aşağı çekince parmağı izler, yeterince çekilince
 * aşağı kayarak kapanır; az çekilirse yerine döner. Boşluğa dokunma, Esc ve kapat düğmesi de aynı kapanış animasyonunu kullanır.
 */
export function useSheet(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const byProp = useRef(false) // prop ile kapatma onClose'u tetiklemesin (bir sayfadan diğerine geçerken yenisini kapatıyordu)
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { if (panel.current) { panel.current.style.transition = ''; panel.current.style.transform = '' } d.showModal() }
    if (!open && d.open) { byProp.current = true; d.close() }
  }, [open])
  const slideClose = () => {
    const p = panel.current
    if (!p || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return }
    p.style.transition = 'transform 200ms cubic-bezier(.4,0,1,1)'; p.style.transform = 'translateY(100%)'
    window.setTimeout(onClose, 190)
  }
  const handlers = {
    onPointerDown: (e: RPE) => { if (e.button !== 0) return; drag.current = { y: e.clientY, t: performance.now(), dy: 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); if (panel.current) panel.current.style.transition = 'none' },
    onPointerMove: (e: RPE) => {
      const g = drag.current; if (!g || !panel.current) return
      g.dy = Math.max(0, e.clientY - g.y); panel.current.style.transform = `translateY(${g.dy}px)`
    },
    onPointerUp: () => {
      const g = drag.current; drag.current = null; if (!g || !panel.current) return
      const v = g.dy / Math.max(1, performance.now() - g.t) // px/ms
      if (g.dy > 90 || (g.dy > 24 && v > 0.5)) slideClose()
      else { panel.current.style.transition = 'transform 180ms ease-out'; panel.current.style.transform = '' }
    },
    onPointerCancel: () => { drag.current = null; if (panel.current) { panel.current.style.transition = 'transform 180ms ease-out'; panel.current.style.transform = '' } },
  }
  const dialogProps = {
    ref,
    onCancel: (e: React.SyntheticEvent) => { e.preventDefault(); slideClose() },
    onClose: () => { if (byProp.current) { byProp.current = false; return } onClose() },
    onClick: (e: React.MouseEvent) => { if (e.target === ref.current) slideClose() },
  }
  return { panel, handlers, dialogProps, slideClose }
}

export const dialogClass = 'm-0 mt-auto w-full max-w-none max-h-[92dvh] bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[sheetUp_.24s_cubic-bezier(.2,.8,.2,1)]'

/** Tutamaç + başlık + kapat düğmesi (aşağı çekme alanı). */
export function SheetHead({ title, handlers, onClose }: { title?: string; handlers: ReturnType<typeof useSheet>['handlers']; onClose: () => void }) {
  return (
    <div {...handlers} className="touch-none select-none cursor-grab active:cursor-grabbing -mx-5 px-5 pt-3 pb-2" data-testid="sheet-handle">
      <div className="mx-auto w-11 h-1.5 rounded-full bg-line-2 mb-3" aria-hidden />
      <div className="flex items-center justify-between gap-3 min-h-10">
        {title ? <h2 className="text-lg font-extrabold px-1">{title}</h2> : <span />}
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Kapat" className="w-10 h-10 rounded-full bg-surface-2 text-ink-2 flex items-center justify-center shrink-0"><Close size={18} /></button>
      </div>
    </div>
  )
}

/** Alttan açılan iletişim kutusu (native <dialog>): odak yönetimi ve Esc tarayıcıdan gelir. */
export default function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const s = useSheet(open, onClose)
  return (
    <dialog {...s.dialogProps} aria-label={title} className={dialogClass}>
      <div ref={s.panel} className="max-w-md mx-auto bg-surface rounded-t-[32px] px-5 safe-bottom max-h-[92dvh] overflow-y-auto overscroll-contain">
        <SheetHead title={title} handlers={s.handlers} onClose={s.slideClose} />
        <div className="pt-2">{open ? children : null}</div>
      </div>
    </dialog>
  )
}
