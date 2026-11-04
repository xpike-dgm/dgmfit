'use client'
import { useEffect, useRef, type ReactNode } from 'react'

/** Alttan açılan iletişim kutusu (native <dialog>): odak yönetimi ve Esc tarayıcıdan gelir. */
export default function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }} aria-label={title}
      className="m-0 mt-auto w-full max-w-none max-h-[92dvh] bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[fadeIn_.2s_ease]">
      <div className="max-w-md mx-auto bg-surface rounded-t-[32px] px-5 pt-3 safe-bottom max-h-[92dvh] overflow-y-auto">
        <div className="mx-auto w-10 h-1.5 rounded-full bg-line-2 mb-4" aria-hidden />
        <h2 className="text-lg font-extrabold mb-4 px-1">{title}</h2>
        {open ? children : null}
      </div>
    </dialog>
  )
}
