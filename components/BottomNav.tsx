'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Dumbbell, Fork, Home, Plus, Users } from './icons'
import QuickAdd from './QuickAdd'

const items = [
  { href: '/', label: 'Bugün', Icon: Home },
  { href: '/fitness', label: 'Fitness', Icon: Dumbbell },
  null,
  { href: '/yemek', label: 'Yemek', Icon: Fork },
  { href: '/sosyal', label: 'Sosyal', Icon: Users },
] as const

export default function BottomNav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  return (
    <>
      <nav aria-label="Ana menü" className="fixed bottom-0 inset-x-0 z-30 bg-[rgba(17,19,15,0.94)] backdrop-blur-xl border-t border-surface-2 safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center px-3 pt-2">
          {items.map((it, i) =>
            it ? (
              <Link key={it.href} href={it.href} aria-current={(it.href === '/' ? path === '/' : path.startsWith(it.href)) ? 'page' : undefined}
                className="flex flex-col items-center gap-1 py-1 text-xs font-semibold text-mute aria-[current=page]:text-lime aria-[current=page]:font-bold">
                <it.Icon size={24} />{it.label}
              </Link>
            ) : (
              <button key={i} type="button" onClick={() => setOpen(true)} aria-label="Hızlı ekle" aria-haspopup="dialog"
                className="justify-self-center -mt-5 w-[58px] h-[58px] rounded-full bg-lime text-lime-ink flex items-center justify-center shadow-[0_8px_24px_rgba(200,241,105,0.25)] active:scale-95 transition">
                <Plus size={28} />
              </button>
            ),
          )}
        </div>
      </nav>
      <QuickAdd open={open} onClose={() => setOpen(false)} />
    </>
  )
}
