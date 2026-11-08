'use client'
// Ö1b-2: kullanım tercihleri — tek el modu (sağ/sol) ve boş yere basılı tutunca "Ekranı düzenle". Seçim anında kaydedilir.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UsePrefs } from '@/lib/cards/prefs'
import { savePrefsAction } from './actions'

const HANDS: { id: 'left' | 'right' | null; label: string }[] = [{ id: null, label: 'Kapalı' }, { id: 'right', label: 'Sağ el' }, { id: 'left', label: 'Sol el' }]

export default function UsePrefsForm({ prefs }: { prefs: UsePrefs }) {
  const [v, setV] = useState({ hand: prefs.hand ?? null, holdToEdit: prefs.holdToEdit !== false })
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const save = (n: typeof v) => {
    const old = v
    setV(n); setMsg(null)
    start(async () => {
      const r = await savePrefsAction(n).catch(() => null)
      if (!r?.ok) { setV(old); setMsg(r && !r.ok ? r.error : 'Kaydedilemedi') } else router.refresh()
    })
  }
  return (
    <section className="card rounded-[22px] p-4 flex flex-col gap-3" aria-label="Kullanım" data-testid="use-prefs">
      <div className="flex flex-col gap-2">
        <span className="flex flex-col"><b className="text-[15px]">Tek el modu</b>
          <span className="text-[12.5px] text-mute leading-snug">Hızlı ekle (+), bant düğmeleri ve kart düğmeleri seçtiğin elin kenarına geçer.</span></span>
        <div role="radiogroup" aria-label="Tek el modu" className="grid grid-cols-3 gap-1 p-1 rounded-full bg-surface-2">
          {HANDS.map((h) => (
            <button key={h.label} type="button" role="radio" aria-checked={v.hand === h.id} disabled={pending} onClick={() => save({ ...v, hand: h.id })}
              className="h-10 rounded-full text-[13.5px] font-bold text-mute aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm">{h.label}</button>
          ))}
        </div>
      </div>
      <label htmlFor="hold-edit" className="flex items-center justify-between gap-3 min-h-11 cursor-pointer border-t border-line pt-3">
        <span className="flex flex-col"><b className="text-[15px]">Basılı tutunca düzenle</b>
          <span className="text-[12.5px] text-mute leading-snug">Ekranda düğme olmayan bir yere basılı tut: “Ekranı düzenle” çıkar.</span></span>
        <input id="hold-edit" type="checkbox" role="switch" checked={v.holdToEdit} disabled={pending} data-testid="hold-edit-toggle"
          onChange={(e) => save({ ...v, holdToEdit: e.target.checked })}
          className="appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
      </label>
      {msg ? <p role="status" className="text-[13px] text-danger">{msg}</p> : null}
    </section>
  )
}
