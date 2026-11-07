'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TRACKER_KINDS, type TrackerKind } from '@/lib/cards/custom'
import { trackerAction } from '../actions'

type T = { id: string; name: string; unit: string; kind: TrackerKind; goal: number | null; goalDir: 'min' | 'max'; step: number; emoji: string; today: number | null; week: { series: (number | null)[]; value: number | null; loggedDays: number } }
const EMOJI = ['☕', '🚬', '😴', '🙂', '⚡', '💊', '🧘', '🚶', '📖', '🍬', '🦷', '✅']

export default function Trackers({ list }: { list: T[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', unit: '', kind: 'count' as TrackerKind, goal: '', goalDir: 'max' as 'min' | 'max', step: '1', emoji: '☕' })
  const run = (input: Record<string, unknown>, ok: string) => start(async () => {
    const r = await trackerAction(input).catch(() => null)
    if (!r?.ok) { setMsg(r && !r.ok ? r.error : 'Kaydedilemedi'); return }
    setMsg(ok); router.refresh()
  })
  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const goal = f.goal ? Number(f.goal.replace(',', '.')) : null
    run({ op: 'create', name: f.name, unit: f.unit, kind: f.kind, goal: goal && goal > 0 ? goal : null, goalDir: f.goalDir, step: Number(f.step) || 1, emoji: f.emoji }, `“${f.name}” eklendi`)
    setF({ ...f, name: '', unit: '', goal: '' })
  }
  const inp = 'h-11 rounded-xl px-3 bg-surface-2 border border-line text-[15px] w-full'
  return (
    <>
      {list.length ? (
        <section aria-label="Takip alanlarım" className="card px-4 py-1 flex flex-col">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-3 min-h-14 border-t border-line first:border-0 py-2" data-tracker={t.name}>
              <span className="text-[22px] w-8 text-center" aria-hidden>{t.emoji}</span>
              <span className="flex-1 min-w-0 flex flex-col">
                <b className="text-[14.5px] truncate">{t.name}</b>
                <span className="text-[12px] text-mute">{TRACKER_KINDS.find((k) => k.id === t.kind)?.label} · bugün <b className="num text-ink" data-testid="tracker-today">{t.today ?? '—'}</b>{t.unit ? ` ${t.unit}` : ''} · 7 günde {t.week.loggedDays} gün kayıt{t.goal ? ` · hedef ${t.goalDir === 'max' ? 'en çok' : 'en az'} ${t.goal}` : ''}</span>
              </span>
              <button type="button" disabled={pending} onClick={() => { if (confirm(`“${t.name}” arşivlensin mi? Kayıtların silinmez.`)) run({ op: 'archive', id: t.id }, 'Arşivlendi') }}
                className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" aria-label={`${t.name} arşivle`}>Arşivle</button>
            </div>
          ))}
        </section>
      ) : <p className="text-[13.5px] text-mute leading-relaxed">Uygulamada olmayan bir şeyi mi takip etmek istiyorsun? Kahve, sigara, uyku saati, ruh hali… Burada tanımla, sonra <Link className="font-bold text-acc" href="/profil/ozellestirme/kartlarim">Kart oluşturucu</Link> ile istediğin ekrana kart olarak ekle.</p>}

      <form onSubmit={create} className="card p-4 flex flex-col gap-3" aria-label="Yeni takip alanı" data-testid="tracker-form">
        <b className="text-[15px]">Yeni takip alanı</b>
        <label className="flex flex-col gap-1 text-[13px] font-bold">Ad<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} placeholder="Örn. Kahve" data-testid="tr-name" /></label>
        <fieldset className="flex flex-col gap-1.5"><legend className="text-[13px] font-bold mb-1">Tür</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tür">
            {TRACKER_KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={f.kind === k.id} onClick={() => setF({ ...f, kind: k.id })} data-testid={`tr-kind-${k.id}`}
                className="text-left rounded-xl border border-line p-2.5 aria-checked:border-acc aria-checked:bg-acc/10"><b className="text-[13.5px] block">{k.label}</b><span className="text-[11.5px] text-mute leading-snug">{k.hint}</span></button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          {f.kind !== 'yesno' && f.kind !== 'scale' ? <label className="flex flex-col gap-1 text-[13px] font-bold">Birim<input className={inp} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={12} placeholder="fincan, saat…" data-testid="tr-unit" /></label> : null}
          {f.kind === 'count' ? <label className="flex flex-col gap-1 text-[13px] font-bold">Her dokunuşta<input className={inp} value={f.step} onChange={(e) => setF({ ...f, step: e.target.value })} inputMode="decimal" /></label> : null}
          <label className="flex flex-col gap-1 text-[13px] font-bold">Günlük hedef<input className={inp} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} inputMode="decimal" placeholder="isteğe bağlı" data-testid="tr-goal" /></label>
          {f.goal ? <label className="flex flex-col gap-1 text-[13px] font-bold">Hedef yönü<select className={inp} value={f.goalDir} onChange={(e) => setF({ ...f, goalDir: e.target.value as 'min' | 'max' })}><option value="max">En çok (azaltmak)</option><option value="min">En az (artırmak)</option></select></label> : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Simge">
          {EMOJI.map((e) => <button key={e} type="button" role="radio" aria-checked={f.emoji === e} aria-label={e} onClick={() => setF({ ...f, emoji: e })} className="w-10 h-10 rounded-full border border-line text-[19px] aria-checked:border-acc aria-checked:ring-2 aria-checked:ring-acc/40">{e}</button>)}
        </div>
        <button type="submit" disabled={pending || f.name.trim().length < 2} className="h-12 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-50" data-testid="tr-create">Ekle</button>
        {msg ? <p className="text-[13px] text-ink-2" role="status" data-testid="tr-msg">{msg}</p> : null}
      </form>
    </>
  )
}
