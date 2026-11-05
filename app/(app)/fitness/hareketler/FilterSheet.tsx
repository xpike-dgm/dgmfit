'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn } from '@/components/ui'

type Group = { key: string; title: string; options: [string, string][]; value?: string }

/** Hareket filtreleri: tek düğme → alt pencerede açılır menüler (kas, ekipman, tip, zorluk). */
export default function FilterSheet({ q, groups }: { q?: string; groups: Group[] }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(groups.map((g) => [g.key, g.value ?? ''])))
  const router = useRouter()
  const active = groups.filter((g) => g.value).length
  const apply = (vals: Record<string, string>) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    for (const [k, x] of Object.entries(vals)) if (x) p.set(k, x)
    const s = p.toString()
    router.push('/fitness/hareketler' + (s ? '?' + s : ''))
  }
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => setOpen(true)} className="h-10 px-4 rounded-full bg-surface border border-line text-[14px] font-bold inline-flex items-center gap-2">
          Filtrele{active ? <span className="min-w-5 h-5 px-1 rounded-full bg-acc text-acc-ink text-[11px] num inline-flex items-center justify-center">{active}</span> : null}
        </button>
        {groups.filter((g) => g.value).map((g) => (
          <button key={g.key} type="button" aria-label={`${g.title} filtresini kaldır`} onClick={() => apply({ ...Object.fromEntries(groups.map((x) => [x.key, x.value ?? ''])), [g.key]: '' })}
            className="h-9 pl-3 pr-2 rounded-full bg-acc/15 text-acc text-[13px] font-bold inline-flex items-center gap-1.5">
            {g.options.find((o) => o[0] === g.value)?.[1]} <span aria-hidden className="text-[15px] leading-none">×</span>
          </button>
        ))}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filtrele">
        <form className="flex flex-col gap-3 pb-4" onSubmit={(e) => { e.preventDefault(); setOpen(false); apply(v) }}>
          {groups.map((g) => (
            <label key={g.key} htmlFor={`f-${g.key}`} className="flex flex-col gap-1.5 text-sm font-semibold">{g.title}
              <select id={`f-${g.key}`} value={v[g.key]} onChange={(e) => setV({ ...v, [g.key]: e.target.value })} className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal">
                <option value="">Tümü</option>
                {g.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button type="button" className={btn.secondary + ' h-12'} onClick={() => setV(Object.fromEntries(groups.map((g) => [g.key, ''])))}>Temizle</button>
            <button type="submit" className={btn.primary + ' h-12'}>Uygula</button>
          </div>
        </form>
      </Sheet>
    </>
  )
}
