'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { logWeight } from '@/app/(app)/actions'
import { applyCheckinAction, cancelBankAction, closeDayAction, createBankAction, exceptionAction, reopenDayAction } from './actions'

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR')

function useAct() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  const run = (fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, okText: (r: Record<string, unknown>) => string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) { setMsg({ ok: false, text: r.error ?? 'Bir hata oldu' }); return }
      setMsg({ ok: true, text: okText(r) })
      router.refresh()
    })
  return { pending, msg, run }
}

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null
  return <p role="status" className={`text-[13px] leading-relaxed ${m.ok ? 'text-acc' : 'text-danger'}`}>{m.text}</p>
}

const KIND_TEXT: Record<string, string> = {
  balanced: 'Gün hedefte kapandı.',
  incomplete: 'Kayıt hedefin %60\'ının altında; eksik kayıt sayıldı, dengeleme yapılmadı.',
  untracked: 'Kayıt olmadığı için dengeleme yapılmadı.',
}

export function DayClose({ day, closed, items, result }: { day: string; closed: boolean; items: number; result: { kind: string; diff: number } | null }) {
  const { pending, msg, run } = useAct()
  const text = (kind: string, diff: number) => KIND_TEXT[kind] ?? (diff > 0 ? `${fmt(diff)} kcal fazla; sonraki günlere dağıtıldı.` : `${fmt(-diff)} kcal sonraki günlere eklendi.`)
  if (closed) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-[13px] text-ink-2" data-testid="day-closed">Gün kapandı. {result ? text(result.kind, result.diff) : ''}</span>
          <button type="button" className={btn.ghost} disabled={pending} onClick={() => run(() => reopenDayAction(day), () => 'Gün yeniden açıldı.')}>Yeniden aç</button>
        </div>
        <Msg m={msg} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={btn.secondary} disabled={pending || items === 0}
        onClick={() => run(() => closeDayAction(day), (r) => text(String(r.kind), Number(r.diff)))}>
        {pending ? 'Kapatılıyor…' : 'Günü kapat'}
      </button>
      {items === 0 ? <span className="text-[12px] text-mute">Kapatmak için önce bugünün öğünlerini kaydet.</span> : null}
      <Msg m={msg} />
    </div>
  )
}

/** Sayfanın kalıcı bölgesinde duran durum mesajı: kaybolan kartların (ör. istisna) sonucunu gösterir. */
export function FitFlash() {
  const [m, setM] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    const h = (e: Event) => setM((e as CustomEvent<{ ok: boolean; text: string }>).detail)
    window.addEventListener('dgfit:flash', h)
    return () => window.removeEventListener('dgfit:flash', h)
  }, [])
  return m ? <div className="card px-4 py-3"><Msg m={m} /></div> : null
}
const flash = (ok: boolean, text: string) => window.dispatchEvent(new CustomEvent('dgfit:flash', { detail: { ok, text } }))

export function ExceptionButton({ day }: { day: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <button type="button" className={btn.secondary} disabled={pending}
      onClick={() => start(async () => {
        const r = await exceptionAction(day)
        if (!r.ok) { flash(false, r.error); return }
        flash(true, r.daysAdded ? `İstisna sayıldı; hedef tarih ${r.daysAdded} gün uzadı.` : 'İstisna sayıldı.')
        router.refresh()
      })}>
      İstisna say
    </button>
  )
}

export function BankForm({ days }: { days: { day: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState(days[Math.min(3, days.length - 1)]?.day ?? '')
  const [extra, setExtra] = useState(500)
  const [note, setNote] = useState('')
  const { pending, msg, run } = useAct()
  if (!days.length) return <p className="text-[13px] text-mute">Hedef tarihe çok az kaldı; banka kullanılamıyor.</p>
  if (!open) return <button type="button" className={btn.secondary} onClick={() => setOpen(true)}>Etkinlik ekle</button>
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createBankAction({ day, extra, note }); if (r.ok) { setNote('') } return r }, (r) => `Hazır: ${r.days} gün boyunca günde ${fmt(Number(r.perDay))} kcal biriktirilecek.`) }}>
      <label className="flex flex-col gap-1.5 text-sm font-semibold" htmlFor="bank-day">Etkinlik günü
        <select id="bank-day" value={day} onChange={(e) => setDay(e.target.value)} className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal">
          {days.map((d) => <option key={d.day} value={d.day}>{d.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold" htmlFor="bank-extra">
        <span className="flex justify-between">Ekstra kalori <b className="num">{fmt(extra)} kcal</b></span>
        <input id="bank-extra" type="range" min={100} max={1500} step={50} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className=" h-8" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold" htmlFor="bank-note">Not (isteğe bağlı)
        <input id="bank-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 40))} placeholder="Ör. düğün" className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal" />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={`${btn.primary} flex-1 h-12 text-[15px]`} disabled={pending}>{pending ? 'Planlanıyor…' : 'Biriktirmeye başla'}</button>
        <button type="button" className={btn.ghost} onClick={() => setOpen(false)}>Vazgeç</button>
      </div>
      <Msg m={msg} />
    </form>
  )
}

export function CancelBank({ bankId }: { bankId: string }) {
  const { pending, run } = useAct()
  return (
    <button type="button" className={btn.ghost} disabled={pending}
      onClick={() => { if (confirm('Etkinlik iptal edilsin mi? Henüz gelmemiş biriktirme günleri ve ekstra kalori kaldırılır.')) run(() => cancelBankAction(bankId), () => 'İptal edildi') }}>
      İptal
    </button>
  )
}

export function CheckinApply() {
  const { pending, msg, run } = useAct()
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" className={`${btn.primary} h-11 text-[15px] px-5`} disabled={pending}
        onClick={() => run(() => applyCheckinAction(), (r) => `Yeni günlük hedef ${fmt(Number(r.kcal))} kcal.`)}>Uygula</button>
      <Msg m={msg} />
    </span>
  )
}

export function WeighIn({ last }: { last: number }) {
  const [kg, setKg] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const save = () => {
    const v = Number(kg.replace(',', '.'))
    if (!(v >= 30 && v <= 250)) { setErr('30 ile 250 kg arasında bir değer gir'); return }
    start(async () => {
      const r = await logWeight(v)
      if (r?.error) { setErr(r.error); return }
      setErr(null); setKg(''); setDone(true); router.refresh()
    })
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="flex gap-2">
        <label htmlFor="fit-kg" className="sr-only">Kilo (kg)</label>
        <input id="fit-kg" inputMode="decimal" value={kg} onChange={(e) => { setKg(e.target.value); setDone(false) }} placeholder={String(last).replace('.', ',')}
          className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-ink" />
        <button type="submit" className={`${btn.primary} h-12 text-[15px] px-5`} disabled={pending}>Kaydet</button>
      </div>
      {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : done ? <p role="status" className="text-[13px] text-acc">Tartı kaydedildi.</p> : null}
    </form>
  )
}
