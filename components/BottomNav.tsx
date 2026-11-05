'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { hidesNav, tabFor, type TabId } from '@/lib/theme'
import { Drop, Dumbbell, Fork, Home, Plus, Target, Users } from './icons'
import QuickAdd from './QuickAdd'

const items: ({ id: TabId; href: string; label: string; Icon: typeof Home } | null)[] = [
  { id: 'today', href: '/', label: 'Bugün', Icon: Home },
  { id: 'plan', href: '/fit', label: 'Fit', Icon: Target },
  { id: 'water', href: '/su', label: 'Su', Icon: Drop },
  null,
  { id: 'food', href: '/yemek', label: 'Yemek', Icon: Fork },
  { id: 'fitness', href: '/fitness', label: 'Fitness', Icon: Dumbbell },
  { id: 'social', href: '/sosyal', label: 'Sosyal', Icon: Users },
]
const TAB_MOD: Record<TabId, string> = { today: 'today', plan: 'plan', water: 'water', food: 'food', fitness: 'fitness', social: 'social' }

export default function BottomNav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  if (hidesNav(path)) return null
  const tab = tabFor(path)
  return (
    <>
      <nav aria-label="Ana menü" className="fixed bottom-0 inset-x-0 z-30 px-2 safe-bottom pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto h-[64px] rounded-[22px] bg-nav backdrop-blur-xl border border-line shadow-[0_6px_24px_rgba(0,0,0,0.12)] grid grid-cols-7 items-center px-1">
          {items.map((it, i) =>
            it ? (
              <Link key={it.href} href={it.href} data-mod={TAB_MOD[it.id]} aria-current={tab === it.id ? 'page' : undefined}
                className="mx-0.5 flex flex-col items-center justify-center gap-1 h-[52px] rounded-2xl text-[10.5px] font-bold text-mute aria-[current=page]:text-acc aria-[current=page]:bg-[color-mix(in_oklab,var(--color-acc)_15%,transparent)]">
                <it.Icon size={21} /><span className="max-[350px]:sr-only">{it.label}</span>
              </Link>
            ) : (
              <button key={i} type="button" onClick={() => setOpen(true)} aria-label="Hızlı ekle" aria-haspopup="dialog"
                className="justify-self-center w-[46px] h-[46px] rounded-2xl bg-acc text-acc-ink flex items-center justify-center active:scale-95 transition">
                <Plus size={24} />
              </button>
            ),
          )}
        </div>
      </nav>
      <QuickAdd open={open} onClose={() => setOpen(false)} />
    </>
  )
}
