'use client'
import { useState } from 'react'
import { fmtNum } from '@/lib/calc'
import { toggleShoppingAction } from '../actions'

type G = { aisle: string; items: { id: number; name: string; grams: number; checked: boolean }[] }
const amount = (g: number) => (g >= 1000 ? `${fmtNum(Math.round(g / 100) / 10, 1)} kg` : `${fmtNum(g)} g`)

export default function ShopList({ groups }: { groups: G[] }) {
  const [state, setState] = useState(() => new Map(groups.flatMap((g) => g.items.map((x) => [x.id, x.checked] as const))))
  const total = state.size, done = [...state.values()].filter(Boolean).length
  return (
    <div className="flex flex-col gap-3" data-testid="shop">
      <p className="text-[13px] text-mute px-1">{done}/{total} alındı · yemekler tarif malzemelerine açıldı, miktarlar menüdeki porsiyonlardan</p>
      {groups.map((g) => (
        <section key={g.aisle} className="card px-4 py-3 flex flex-col" aria-label={g.aisle} data-testid="shop-aisle">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute mb-1">{g.aisle}</span>
          {g.items.map((x) => (
            <label key={x.id} className="flex items-center gap-3 min-h-11 border-b border-line last:border-0">
              <input type="checkbox" checked={state.get(x.id) ?? false} className="w-5 h-5 accent-[var(--color-lime)]"
                onChange={(e) => { const c = e.target.checked; setState(new Map(state).set(x.id, c)); void toggleShoppingAction(x.id, c) }} />
              <span className={`flex-1 text-[14px] ${state.get(x.id) ? 'line-through text-mute' : ''}`}>{x.name}</span>
              <span className="num text-[13px] text-mute">{amount(x.grams)}</span>
            </label>
          ))}
        </section>
      ))}
    </div>
  )
}
