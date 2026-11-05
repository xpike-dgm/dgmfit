'use client'
import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtNum } from '@/lib/calc'
import type { Extra } from '@/lib/supplements'
import { Info, Plus } from '@/components/icons'
import { servingAction } from './actions'

interface S { id: number; name: string; brand: string | null; unit: string; label: string; serving: { kcal: number; protein: number }; extras: Extra[]; daily: number | null; count: number }

/** Yemek ekranındaki takviye kartı: her takviye için bugünkü porsiyon sayısı ve −/+ düğmeleri. */
export default function SupplementCard({ day, items, extras, warnings, totals }: { day: string; items: S[]; extras: Extra[]; warnings: string[]; totals: { kcal: number; protein: number } }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [counts, bump] = useOptimistic(Object.fromEntries(items.map((i) => [i.id, i.count])) as Record<number, number>, (s, [id, d]: [number, number]) => ({ ...s, [id]: Math.max(0, (s[id] ?? 0) + d) }))
  const tap = (id: number, d: 1 | -1) => start(async () => { bump([id, d]); const r = await servingAction(id, day, d); setErr(r.ok ? null : r.error); router.refresh() })
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Takviyeler" data-testid="supplements">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-extrabold text-[16px]">Takviyeler</h2>
          <p className="text-[12.5px] text-mute truncate">{items.length ? (totals.kcal ? `Bugün ${fmtNum(totals.kcal)} kcal · ${fmtNum(totals.protein)} g protein günlüğe eklendi` : 'Porsiyonu işaretle, günlüğe eklensin') : 'Kullandığın takviyeyi bir kez tanımla, sonra yalnızca işaretle'}</p>
        </div>
        <Link href="/yemek/takviyeler" className="text-[13px] font-bold text-acc shrink-0 px-1 py-2" data-testid="supp-manage">{items.length ? 'Düzenle' : ''}</Link>
      </div>
      {items.map((s) => {
        const n = counts[s.id] ?? 0
        const done = s.daily !== null && n >= s.daily
        return (
          <div key={s.id} className="flex items-center gap-3 border-t border-line pt-3" data-testid="supp-row" data-name={s.name}>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[14.5px] font-bold truncate">{s.name}{s.brand ? <span className="text-mute font-semibold"> · {s.brand}</span> : null}</span>
              <span className="text-[12px] text-mute truncate">{s.label}{s.serving.kcal ? ` · ${fmtNum(s.serving.kcal)} kcal` : ''}{s.serving.protein ? ` · ${fmtNum(s.serving.protein, 1)} g P` : ''}{s.extras.length ? ` · ${s.extras.map((e) => `${e.name} ${fmtNum(e.amount, e.amount % 1 ? 1 : 0)} ${e.unit}`).join(', ')}` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" aria-label={`${s.name} bir porsiyon azalt`} disabled={n <= 0} onClick={() => tap(s.id, -1)}
                className="w-9 h-9 rounded-full border border-line-2 text-[20px] font-bold leading-none flex items-center justify-center disabled:opacity-30">−</button>
              <span className={`min-w-[44px] text-center num font-bold text-[15px] ${done ? 'text-good' : ''}`} data-testid="supp-count">{fmtNum(n, n % 1 ? 1 : 0)}{s.daily !== null ? <span className="text-mute text-[12px] font-semibold">/{s.daily}</span> : null}</span>
              <button type="button" aria-label={`${s.name} bir porsiyon ekle`} onClick={() => tap(s.id, 1)}
                className="w-9 h-9 rounded-full bg-acc text-acc-ink flex items-center justify-center"><Plus size={18} /></button>
            </div>
          </div>
        )
      })}
      {extras.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-3" data-testid="supp-extras">
          {extras.map((e) => <span key={e.name + e.unit} className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-surface-2 border border-line">{e.name} <b className="num">{fmtNum(e.amount, e.amount % 1 ? 1 : 0)} {e.unit}</b></span>)}
        </div>
      ) : null}
      {warnings.map((w) => <p key={w} role="alert" className="text-[13px] font-semibold text-danger flex gap-2"><Info size={16} className="shrink-0 mt-0.5" />{w}</p>)}
      {err ? <p role="status" className="text-[13px] text-danger">{err}</p> : null}
      {!items.length ? <Link href="/yemek/takviyeler/yeni" className="h-11 rounded-full border border-line-2 font-bold text-[14px] flex items-center justify-center gap-2" data-testid="supp-add"><Plus size={16} /> Takviye ekle</Link> : null}
    </section>
  )
}
