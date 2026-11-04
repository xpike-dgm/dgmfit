'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { EQUIPMENT, KIND, MUSCLES, MUSCLE_ORDER, PATTERN } from '@/lib/exercise-labels'
import { createCustomExerciseAction } from '../actions'

export default function CustomExercise() {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ name: '', primary: 'chest', equipment: 'machine', kind: 'weight_reps', pattern: 'push' })
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  if (!open) return <button type="button" className={btn.secondary} onClick={() => setOpen(true)}>Kendi hareketini ekle</button>
  const Sel = ({ id, label, k, map, order }: { id: string; label: string; k: keyof typeof v; map: Record<string, string>; order?: string[] }) => (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm font-semibold">{label}
      <select id={id} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal">
        {(order ?? Object.keys(map)).map((key) => <option key={key} value={key}>{map[key]}</option>)}
      </select>
    </label>
  )
  return (
    <form className="card p-5 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { setErr(null); const r = await createCustomExerciseAction(v as never); if (!r.ok) { setErr(r.error); return } router.push(`/fitness/hareketler/${r.id}`) }) }}>
      <Eyebrow>Özel hareket</Eyebrow>
      <label htmlFor="cx-name" className="flex flex-col gap-1 text-sm font-semibold">Ad
        <input id="cx-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value.slice(0, 60) })} placeholder="Ör. Salonumdaki göğüs makinesi" className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal" />
      </label>
      <Sel id="cx-m" label="Birincil kas" k="primary" map={MUSCLES} order={MUSCLE_ORDER} />
      <Sel id="cx-e" label="Ekipman" k="equipment" map={EQUIPMENT} />
      <Sel id="cx-k" label="Kayıt türü" k="kind" map={KIND} />
      <Sel id="cx-p" label="Hareket tipi" k="pattern" map={PATTERN} />
      <button type="submit" className={btn.primary} disabled={pending || v.name.trim().length < 2}>Kaydet</button>
      {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
      <p className="text-[11px] text-mute">Fotoğraf ekleme Faz 3b'de.</p>
    </form>
  )
}
