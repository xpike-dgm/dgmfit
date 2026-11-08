'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TRACKER_KINDS, type TrackerKind } from '@/lib/cards/custom'
import { trackerAction } from '../actions'
import { ask } from '@/components/Confirm'
import Sheet from '@/components/Sheet'
import { Group, Ico, IconBox, segClass, type IconName } from '@/components/cards/StudioUI'

type T = { id: string; name: string; unit: string; kind: TrackerKind; goal: number | null; goalDir: 'min' | 'max'; step: number; emoji: string; today: number | null; week: { series: (number | null)[]; value: number | null; loggedDays: number } }
const EMOJI = ['☕', '🚬', '😴', '🙂', '⚡', '💊', '🧘', '🚶', '📖', '🍬', '🦷', '✅']

const KIND_ICON: Record<TrackerKind, IconName> = { count: 'plus', number: 'chart', scale: 'target', yesno: 'check' }

/** G1: takip alanları — liste (emoji, bugünkü değer, 7 gün) + "Yeni takip alanı" alt penceresi. */
export default function Trackers({ list }: { list: T[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', unit: '', kind: 'count' as TrackerKind, goal: '', goalDir: 'max' as 'min' | 'max', step: '1', emoji: '☕' })
  const run = (input: Record<string, unknown>, ok: string, after?: () => void) => start(async () => {
    const r = await trackerAction(input).catch(() => null)
    if (!r?.ok) { setMsg(r && !r.ok ? r.error : 'Kaydedilemedi'); return }
    setMsg(ok); after?.(); router.refresh()
  })
  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const goal = f.goal ? Number(f.goal.replace(',', '.')) : null
    run({ op: 'create', name: f.name, unit: f.unit, kind: f.kind, goal: goal && goal > 0 ? goal : null, goalDir: f.goalDir, step: Number(f.step) || 1, emoji: f.emoji }, `“${f.name}” eklendi`,
      () => { setOpen(false); setF({ ...f, name: '', unit: '', goal: '' }) })
  }
  const inp = 'h-12 rounded-[14px] px-3.5 bg-surface-2 border border-line text-[15px] w-full outline-none focus:border-acc'
  const label = (t: string) => <span className="text-[12px] font-bold tracking-[0.04em] uppercase text-mute">{t}</span>
  return (
    <>
      <button type="button" onClick={() => { setMsg(null); setOpen(true) }} className="min-h-14 rounded-[20px] bg-acc text-acc-ink font-extrabold text-[15px] inline-flex items-center justify-center gap-2" data-testid="tr-new">
        <Ico name="plus" size={20} />Yeni takip alanı
      </button>
      {msg && !open ? <p className="text-[13px] font-bold text-ink-2 px-1 -mt-1" role="status" data-testid="tr-msg">{msg}</p> : null}
      {list.length ? (
        <Group label="Takip alanların">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-3 min-h-[68px] px-3.5 py-2" data-tracker={t.name}>
              <span className="w-10 h-10 rounded-[13px] bg-surface-2 text-[21px] flex items-center justify-center shrink-0" aria-hidden>{t.emoji}</span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5 leading-tight">
                <b className="text-[15px] font-extrabold truncate">{t.name}</b>
                <span className="text-[12.5px] text-mute">{TRACKER_KINDS.find((k) => k.id === t.kind)?.label} · 7 günde {t.week.loggedDays} gün{t.goal ? ` · hedef ${t.goalDir === 'max' ? '≤' : '≥'} ${t.goal}` : ''}</span>
              </span>
              <span className="flex flex-col items-end leading-tight shrink-0">
                <b className="num text-[17px]" data-testid="tracker-today">{t.today ?? '—'}</b>
                <span className="text-[11px] text-mute">bugün{t.unit ? ` · ${t.unit}` : ''}</span>
              </span>
              <button type="button" disabled={pending} onClick={async () => { if (await ask(`“${t.name}” arşivlensin mi? Kayıtların silinmez.`)) run({ op: 'archive', id: t.id }, 'Arşivlendi') }}
                className="w-9 h-9 rounded-full bg-surface-2 text-mute flex items-center justify-center shrink-0" aria-label={`${t.name} arşivle`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4" /></svg>
              </button>
            </div>
          ))}
        </Group>
      ) : (
        <div className="card rounded-[22px] p-5 flex flex-col items-center text-center gap-2">
          <span className="text-[30px]" aria-hidden>☕ 😴 🙂</span>
          <b className="text-[15px]">Uygulamada olmayanı takip et</b>
          <span className="text-[13px] text-mute leading-snug max-w-[290px]">Kahve, sigara, uyku, ruh hali… Burada tanımla, sonra <Link className="font-bold text-acc" href="/profil/ozellestirme/kartlarim">Kendi kartlarım</Link>’dan istediğin ekrana kart olarak ekle.</span>
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni takip alanı">
        <form onSubmit={create} className="flex flex-col gap-4" aria-label="Yeni takip alanı" data-testid="tracker-form" data-mod="today">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-[18px] bg-surface-2 text-[28px] flex items-center justify-center shrink-0" aria-hidden>{f.emoji}</span>
            <input className={inp + ' font-bold'} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} placeholder="Ad (ör. Kahve)" aria-label="Ad" data-testid="tr-name" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5" role="radiogroup" aria-label="Simge">
            {EMOJI.map((e) => <button key={e} type="button" role="radio" aria-checked={f.emoji === e} aria-label={e} onClick={() => setF({ ...f, emoji: e })} className="w-11 h-11 shrink-0 rounded-full bg-surface-2 border border-line text-[20px] aria-checked:border-2 aria-checked:border-acc">{e}</button>)}
          </div>
          <div className="flex flex-col gap-2">
            {label('Tür')}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tür">
              {TRACKER_KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={f.kind === k.id} onClick={() => setF({ ...f, kind: k.id })} data-testid={`tr-kind-${k.id}`}
                  className="min-h-[72px] text-left rounded-[16px] border border-line bg-surface-2 p-3 flex flex-col gap-1 aria-checked:border-2 aria-checked:border-acc aria-checked:bg-[color-mix(in_oklab,var(--color-acc)_10%,var(--color-surface-2))]">
                  <span className="flex items-center gap-1.5"><span className="text-acc"><Ico name={KIND_ICON[k.id]} size={17} /></span><b className="text-[13.5px]">{k.label}</b></span>
                  <span className="text-[11.5px] text-mute leading-snug">{k.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {f.kind !== 'yesno' && f.kind !== 'scale' ? <label className="flex flex-col gap-2">{label('Birim')}<input className={inp} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={12} placeholder="fincan, saat…" data-testid="tr-unit" /></label> : null}
            {f.kind === 'count' ? <label className="flex flex-col gap-2">{label('Her dokunuşta')}<input className={inp + ' num'} value={f.step} onChange={(e) => setF({ ...f, step: e.target.value })} inputMode="decimal" /></label> : null}
            <label className="flex flex-col gap-2">{label('Günlük hedef')}<input className={inp + ' num'} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} inputMode="decimal" placeholder="isteğe bağlı" data-testid="tr-goal" /></label>
          </div>
          {f.goal ? (
            <div className="flex flex-col gap-2">
              {label('Hedef yönü')}
              <div role="radiogroup" aria-label="Hedef yönü" className="grid grid-cols-2 gap-1 p-1 rounded-full bg-surface-2">
                {([['max', 'En çok (azalt)'], ['min', 'En az (artır)']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={f.goalDir === v} onClick={() => setF({ ...f, goalDir: v })} className={segClass}>{l}</button>)}
              </div>
            </div>
          ) : null}
          {msg && open ? <p className="text-[13px] font-bold text-danger" role="alert">{msg}</p> : null}
          <div className="sheet-actions z-10 -mx-5 px-5 pt-3 bg-gradient-to-t from-surface via-surface to-transparent">
            <button type="submit" disabled={pending || f.name.trim().length < 2} className="w-full h-14 rounded-full bg-acc text-acc-ink font-extrabold text-[15px] disabled:opacity-40" data-testid="tr-create">Takip alanını ekle</button>
          </div>
        </form>
      </Sheet>
    </>
  )
}
