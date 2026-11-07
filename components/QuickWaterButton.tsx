'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { addWater } from '@/app/(app)/su/actions'
import { volumeNum } from '@/lib/units'

export default function QuickWaterButton({ ml = 250, compact = false, unit = 'ml' }: { ml?: number; compact?: boolean; unit?: 'ml' | 'oz' }) {
  const amt = `${volumeNum(ml, unit)} ${unit}`
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const go = (force = false) => start(async () => {
    if ('vibrate' in navigator) navigator.vibrate?.(12)
    const r = await addWater({ ml, source: 'button', force })
    if (!r.ok && 'duplicate' in r) { setMsg('dup'); return }
    if (!r.ok) { setMsg(r.error); return }
    setMsg(null); router.refresh()
  })
  if (msg === 'dup') {
    return (
      <div className="relative mt-auto flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Az önce de {amt} eklendi.</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => go(true)} className="flex-1 h-10 rounded-full bg-water text-water-ink font-extrabold text-sm">Yine ekle</button>
          <button type="button" onClick={() => setMsg(null)} className="h-10 px-3 rounded-full text-sm font-bold text-mute">Vazgeç</button>
        </div>
      </div>
    )
  }
  return (
    <button type="button" disabled={pending} onClick={() => go()} aria-label={`${amt} su ekle`}
      className={`relative mt-auto ${compact ? 'h-9 text-[14px]' : 'h-11 text-[15px]'} rounded-full bg-water text-water-ink font-extrabold flex items-center justify-center active:scale-95 transition disabled:opacity-60`}>
      {pending ? 'Ekleniyor…' : `+ ${amt}`}
    </button>
  )
}
