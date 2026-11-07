'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TEXT_SIZES, type TextPref } from '@/lib/theme'
import { Check } from '@/components/icons'
import { setTextSizeAction } from '../actions'

/** P-5: büyük yazı. Seçim anında uygulanır, çerezle bu cihazda saklanır. */
export default function TextSizePicker({ current }: { current: TextPref }) {
  const [v, setV] = useState(current)
  const [pending, start] = useTransition()
  const router = useRouter()
  const pick = (t: TextPref) => {
    setV(t)
    if (t === 'normal') document.documentElement.removeAttribute('data-text')
    else document.documentElement.setAttribute('data-text', t)
    start(async () => { await setTextSizeAction(t); router.refresh() })
  }
  return (
    <section className="card px-4 py-1 flex flex-col" aria-label="Yazı boyutu" data-testid="text-size">
      <h2 className="text-[15px] font-extrabold pt-3 pb-1">Yazı boyutu</h2>
      <div role="radiogroup" aria-label="Yazı boyutu" className="flex flex-col">
        {TEXT_SIZES.map((t, i) => (
          <button key={t.id} type="button" role="radio" aria-checked={v === t.id} disabled={pending} onClick={() => pick(t.id)}
            className={`flex items-center justify-between gap-3 min-h-[60px] text-left ${i ? 'border-t border-line' : ''}`}>
            <span className="flex flex-col"><b className={t.id === 'xl' ? 'text-[18px]' : t.id === 'lg' ? 'text-[16.5px]' : 'text-[15px]'}>{t.label}</b><span className="text-[13px] text-mute">{t.hint}</span></span>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center ${v === t.id ? 'bg-acc text-acc-ink' : 'border border-line-2'}`}>{v === t.id ? <Check size={15} /> : null}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
