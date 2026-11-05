'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { THEMES, type ThemePref } from '@/lib/theme'
import { Check } from '@/components/icons'
import { setThemeAction } from '../actions'

export default function ThemePicker({ current }: { current: ThemePref }) {
  const [v, setV] = useState(current)
  const [pending, start] = useTransition()
  const router = useRouter()
  const pick = (t: ThemePref) => {
    setV(t)
    // Anında uygula (çerez sunucuda yazılır; yenilemede de aynı tema gelir)
    if (t === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
    start(async () => { await setThemeAction(t); router.refresh() })
  }
  return (
    <div role="radiogroup" aria-label="Tema" className="card px-4 py-1 flex flex-col">
      {THEMES.map((t, i) => (
        <button key={t.id} type="button" role="radio" aria-checked={v === t.id} disabled={pending} onClick={() => pick(t.id)}
          className={`flex items-center justify-between gap-3 min-h-[60px] text-left ${i ? 'border-t border-line' : ''}`}>
          <span className="flex flex-col"><b className="text-[15px]">{t.label}</b><span className="text-[13px] text-mute">{t.hint}</span></span>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${v === t.id ? 'bg-acc text-acc-ink' : 'border border-line-2'}`}>{v === t.id ? <Check size={15} /> : null}</span>
        </button>
      ))}
    </div>
  )
}
