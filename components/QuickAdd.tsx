'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logWeight } from '@/app/(app)/actions'
import { btn } from './ui'
import { Dumbbell, Drop, Fork, Pulse, Scale } from './icons'

export default function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<'menu' | 'weight'>('menu')
  const [kg, setKg] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { d.showModal(); setMode('menu'); setErr(null) }
    if (!open && d.open) d.close()
  }, [open])

  const save = () => {
    const v = Number(kg.replace(',', '.'))
    if (!(v >= 30 && v <= 250)) { setErr('30 ile 250 kg arasında bir değer gir'); return }
    start(async () => {
      const r = await logWeight(v)
      if (r?.error) { setErr(r.error); return }
      setKg(''); onClose(); router.refresh()
    })
  }

  const items = [
    { href: '/su', label: 'Su ekle', sub: 'Tek dokunuşla', Icon: Drop, mod: 'water' },
    { href: '/yemek/ekle', label: 'Öğün ekle', sub: 'Arama, barkod, fotoğraf', Icon: Fork, mod: 'food' },
    { href: '/fitness', label: 'Antrenman başlat', sub: 'Programından seç', Icon: Dumbbell, mod: 'fitness' },
    { href: '/fitness/kardiyo', label: 'Kardiyo ekle', sub: 'Koşu, yürüyüş, bisiklet…', Icon: Pulse, mod: 'fitness' },
  ]

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[fadeIn_.2s_ease]">
      <div className="max-w-md mx-auto bg-surface rounded-t-[32px] px-5 pt-3 safe-bottom">
        <div className="mx-auto w-10 h-1.5 rounded-full bg-line-2 mb-5" aria-hidden />
        {mode === 'menu' ? (
          <div className="flex flex-col gap-2 pb-4">
            <h2 className="text-lg font-extrabold mb-2 px-1">Hızlı ekle</h2>
            {items.map((it) => (
              <Link key={it.href} href={it.href} onClick={onClose} data-mod={it.mod} className="flex items-center gap-4 min-h-[64px] px-4 rounded-[20px] bg-surface-2">
                <span className="w-10 h-10 rounded-full bg-acc text-acc-ink flex items-center justify-center"><it.Icon size={20} /></span>
                <span className="flex flex-col"><span className="font-bold">{it.label}</span><span className="text-[13px] text-mute">{it.sub}</span></span>
              </Link>
            ))}
            <button type="button" onClick={() => setMode('weight')} data-mod="plan" className="flex items-center gap-4 min-h-[64px] px-4 rounded-[20px] bg-surface-2 text-left">
              <span className="w-10 h-10 rounded-full bg-acc text-acc-ink flex items-center justify-center"><Scale size={20} /></span>
              <span className="flex flex-col"><span className="font-bold">Kilo gir</span><span className="text-[13px] text-mute">Trend kilon ve planın güncellenir</span></span>
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-4 pb-4" onSubmit={(e) => { e.preventDefault(); save() }}>
            <h2 className="text-lg font-extrabold px-1">Bugünkü kilon</h2>
            <label htmlFor="qa-kg" className="sr-only">Kilo (kg)</label>
            <div className="flex items-baseline gap-2 justify-center">
              <input id="qa-kg" autoFocus inputMode="decimal" placeholder="0,0" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="w-40 bg-transparent text-center num text-[64px] font-bold outline-none placeholder:text-faint" />
              <span className="text-xl font-bold text-mute">kg</span>
            </div>
            <p className="text-center text-[13px] text-mute">En doğru sonuç için sabah, aç karnına tartıl.</p>
            {err ? <p className="text-center text-sm font-semibold text-danger" role="alert">{err}</p> : null}
            <button type="submit" className={btn.primary} disabled={pending || !kg}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</button>
            <button type="button" className={btn.ghost} onClick={() => setMode('menu')}>Vazgeç</button>
          </form>
        )}
      </div>
    </dialog>
  )
}
