'use client'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { hidesNav, tabFor, type TabId } from '@/lib/theme'
import { Drop, Dumbbell, Fork, Home, Plus, Target, Users } from './icons'
import QuickAdd from './QuickAdd'

import { NAV_TABS, type NavTab } from '@/lib/cards/prefs'

const ICON: Record<NavTab, typeof Home> = { today: Home, plan: Target, water: Drop, food: Fork, fitness: Dumbbell, social: Users }
/** Sekmeler + hızlı ekle düğmesi: tek el modunda düğme o elin kenarına, yoksa ortaya. */
function slots(tabs: NavTab[], hand: 'left' | 'right' | null) {
  const list: ({ id: TabId; href: string; label: string; Icon: typeof Home } | null)[] = tabs.map((id) => { const t = NAV_TABS.find((x) => x.id === id)!; return { id, href: t.href, label: t.label, Icon: ICON[id] } })
  list.splice(hand === 'left' ? 0 : hand === 'right' ? list.length : Math.floor(list.length / 2), 0, null)
  return list
}
/** Dokunulan sekme, sayfa gelene kadar hafifçe yanıp söner (dokunuş hemen hissedilsin). */
function Pending() {
  const { pending } = useLinkStatus()
  return pending ? <span aria-hidden className="absolute inset-0 rounded-2xl bg-current opacity-10 animate-pulse" /> : null
}
const TAB_MOD: Record<TabId, string> = { today: 'today', plan: 'plan', water: 'water', food: 'food', fitness: 'fitness', social: 'social' }

export default function BottomNav({ tabs = NAV_TABS.map((t) => t.id), hand = null }: { tabs?: NavTab[]; hand?: 'left' | 'right' | null }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  if (hidesNav(path)) return null
  const tab = tabFor(path)
  const items = slots(tabs, hand)
  return (
    <>
      <nav aria-label="Ana menü" className="fixed bottom-0 inset-x-0 z-30 px-2 safe-bottom pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto h-[64px] rounded-[22px] bg-nav backdrop-blur-xl border border-line shadow-[0_6px_24px_rgba(0,0,0,0.12)] grid items-center px-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} data-testid="bottom-nav">
          {items.map((it, i) =>
            it ? (
              <Link key={it.href} href={it.href} data-tab={it.id} data-mod={TAB_MOD[it.id]} aria-current={tab === it.id ? 'page' : undefined}
                className="relative mx-0.5 flex flex-col items-center justify-center gap-1 h-[52px] rounded-2xl text-[10.5px] font-bold text-mute active:scale-95 transition aria-[current=page]:text-acc aria-[current=page]:bg-[color-mix(in_oklab,var(--color-acc)_15%,transparent)]">
                <it.Icon size={21} /><span className="max-[350px]:sr-only">{it.label}</span><Pending />
              </Link>
            ) : (
              <button key={i} type="button" onClick={() => setOpen(true)} aria-label="Hızlı ekle" aria-haspopup="dialog" data-slot={i}
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
