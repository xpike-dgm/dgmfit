'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NAV_MIN_VISIBLE, NAV_TABS, resolveNav, type NavTab } from '@/lib/cards/prefs'
import { Drop, Dumbbell, Fork, Home, Plus, Target, Users } from '@/components/icons'
import { saveNavAction } from '../actions'

const ICON: Record<NavTab, typeof Home> = { today: Home, plan: Target, water: Drop, food: Fork, fitness: Dumbbell, social: Users }
const label = (id: NavTab) => NAV_TABS.find((t) => t.id === id)!.label

export default function NavEditor({ order: initOrder, hidden: initHidden, custom }: { order: NavTab[]; hidden: NavTab[]; custom: boolean }) {
  const [order, setOrder] = useState(initOrder)
  const [hidden, setHidden] = useState(initHidden)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const visible = resolveNav({ order, hidden }).visible
  const changed = JSON.stringify([order, hidden]) !== JSON.stringify([initOrder, initHidden])
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= order.length) return; const n = order.slice(); [n[i], n[j]] = [n[j], n[i]]; setOrder(n); setMsg(null) }
  const toggle = (id: NavTab) => {
    if (id === 'today') return
    if (!hidden.includes(id) && order.length - hidden.length <= NAV_MIN_VISIBLE) { setMsg(`En az ${NAV_MIN_VISIBLE} sekme görünür kalmalı`); return }
    setHidden(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]); setMsg(null)
  }
  const save = (nav: { order: NavTab[]; hidden: NavTab[] } | null) => start(async () => {
    const r = await saveNavAction(nav).catch(() => null)
    setMsg(r?.ok ? 'Alt bar kaydedildi' : r && !r.ok ? r.error : 'Kaydedilemedi')
    if (r?.ok) router.refresh()
  })
  const slots: (NavTab | null)[] = [...visible]; slots.splice(Math.floor(slots.length / 2), 0, null)
  return (
    <>
      <section aria-label="Önizleme" className="card p-3">
        <div className="h-[56px] rounded-[18px] bg-nav border border-line grid items-center px-1" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }} data-testid="nav-preview">
          {slots.map((id, i) => id ? (
            <span key={id} className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-mute"> {(() => { const I = ICON[id]; return <I size={18} /> })()}<span className="max-[350px]:sr-only">{label(id)}</span></span>
          ) : <span key={'p' + i} className="justify-self-center w-9 h-9 rounded-xl bg-acc text-acc-ink flex items-center justify-center"><Plus size={20} /></span>)}
        </div>
      </section>
      <section aria-label="Sekmeler" className="card px-4 py-1 flex flex-col" data-testid="nav-editor">
        {order.map((id, i) => {
          const I = ICON[id]; const off = hidden.includes(id)
          return (
            <div key={id} className={`flex items-center gap-3 min-h-[60px] ${i ? 'border-t border-line' : ''}`} data-nav-row={id}>
              <span className={`w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center ${off ? 'opacity-40' : ''}`}><I size={18} /></span>
              <span className={`flex-1 flex flex-col ${off ? 'opacity-50' : ''}`}><b className="text-[15px]">{label(id)}</b>{id === 'today' ? <span className="text-[12px] text-mute">Ana sayfa · gizlenemez</span> : off ? <span className="text-[12px] text-mute">Gizli</span> : null}</span>
              <button type="button" aria-label={`${label(id)} yukarı`} disabled={!i} onClick={() => move(i, -1)} className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center disabled:opacity-30" data-testid="nav-up">↑</button>
              <button type="button" aria-label={`${label(id)} aşağı`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center disabled:opacity-30" data-testid="nav-down">↓</button>
              <input type="checkbox" role="switch" aria-label={`${label(id)} görünsün`} checked={!off} disabled={id === 'today'} onChange={() => toggle(id)} data-testid="nav-show"
                className="appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc disabled:opacity-50 before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
            </div>
          )
        })}
      </section>
      <p className="text-[12.5px] text-mute px-1 leading-snug">Gizlediğin bölümler kaybolmaz: Bugün'deki kartlardan ve Profil'den açılır. Hızlı ekle (+) her zaman alt barda.</p>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
      <div className="flex gap-2">
        {custom ? <button type="button" disabled={pending} onClick={() => { setOrder(NAV_TABS.map((t) => t.id)); setHidden([]); save(null) }} className="h-12 px-4 rounded-full border border-line-2 font-bold text-[14px]">Varsayılana dön</button> : null}
        <button type="button" disabled={pending || !changed} onClick={() => save({ order, hidden })} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="nav-save">Kaydet</button>
      </div>
    </>
  )
}
