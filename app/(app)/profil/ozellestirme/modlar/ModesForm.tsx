'use client'
// Ö6: Modlar (gösterilen tasarım) — odak modu 2×2 kutu (biri açık olabilir), Ramazan kartı, düzenle ilgili kısayollar.
import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MODES, type FocusMode, type ModeState } from '@/lib/modes'
import { SectionLabel } from '@/components/cards/StudioHeader'
import { modesAction } from '../actions'

const LOOK: Record<FocusMode, { mod: string; short: string; icon: ReactNode }> = {
  training: { mod: 'fitness', short: 'Program ve toparlanma üstte', icon: <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /> },
  diet: { mod: 'food', short: 'Kalori ve öğünler öne', icon: <><path d="M4 11h16a8 8 0 01-16 0z" /><path d="M8 4v4M12 3v5M16 4v4" /></> },
  vacation: { mod: 'water', short: 'Dengeleme durur, az bildirim', icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> },
  sick: { mod: 'coach', short: 'Su öne, antrenman dinlenir', icon: <path d="M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z" /> },
}

type Extra = { time: boolean; training: boolean; rules: number; hand: 'left' | 'right' | null }

export default function ModesForm({ s, today, extra }: { s: ModeState; today: string; extra: Extra }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [until, setUntil] = useState(s.focusUntil ?? '')
  const [from, setFrom] = useState(s.focusFrom ?? today)
  const [r, setR] = useState({ sahur: s.sahur, iftar: s.iftar, until: s.ramadanUntil ?? '' })
  const save = (patch: Partial<ModeState>, ok: string) => start(async () => {
    const x = await modesAction(patch).catch(() => null)
    if (!x?.ok) { setMsg(x && !x.ok ? x.error : 'Kaydedilemedi'); return }
    setMsg(ok); router.refresh()
  })
  const pick = (id: FocusMode | null) => save({ focus: id, focusFrom: id ? (from || today) : null, focusUntil: id && until ? until : null }, id ? `${MODES.find((m) => m.id === id)!.label} modu açıldı` : 'Odak modu kapatıldı')
  const date = 'h-9 rounded-lg px-2 bg-surface-2 border border-line text-[13px] num min-w-0'
  const row = 'min-h-14 flex items-center justify-between gap-3'
  return (
    <div className="flex flex-col gap-3.5" data-testid="modes-form">
      <SectionLabel>Odak modu · biri açık olabilir</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Odak modu">
        {MODES.map((m) => {
          const on = s.focus === m.id, L = LOOK[m.id]
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} disabled={pending} onClick={() => pick(on ? null : m.id)} data-testid={`mode-${m.id}`} data-mod={L.mod}
              title={m.desc}
              className={`min-h-[92px] rounded-[18px] p-3 text-left flex flex-col gap-1.5 transition ${on ? 'border-2 border-acc bg-[color-mix(in_oklab,var(--color-acc)_12%,var(--color-surface))]' : 'border border-line bg-surface'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{L.icon}</svg>
              <b className="text-[14px] font-extrabold">{m.label}{on ? ' · açık' : ''}</b>
              <span className={`text-[11.5px] leading-snug ${on ? 'text-ink-2' : 'text-mute'}`}>{L.short}</span>
            </button>
          )
        })}
      </div>
      {s.focus ? <div className="flex items-center gap-2 text-[12px] text-mute flex-wrap -mt-1" aria-label="Mod tarihleri">
        <label className="flex items-center gap-1.5">Başlangıç<input type="date" className={date} value={from} max={until || undefined} onChange={(e) => { setFrom(e.target.value); if (s.focus && e.target.value) save({ focusFrom: e.target.value }, 'Başlangıç kaydedildi') }} data-testid="mode-from" /></label>
        <label className="flex items-center gap-1.5">Bitiş<input type="date" className={date} value={until} min={today} onChange={(e) => { setUntil(e.target.value); if (s.focus) save({ focusUntil: e.target.value || null }, 'Bitiş kaydedildi') }} data-testid="mode-until" /></label>
        <button type="button" disabled={pending} onClick={() => pick(null)} className="h-9 px-3 rounded-full border border-line-2 font-bold text-ink" data-testid="mode-off">Kapat</button>
      </div> : null}

      <section aria-label="Ramazan modu" className="ramadan-card rounded-[20px] p-3.5 border flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFD166" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="ramadan-moon"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /><path d="M17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6z" /></svg>
            <b className="text-[15px] font-extrabold">Ramazan modu</b>
          </span>
          <button type="button" role="switch" aria-checked={s.ramadan} aria-label="Ramazan modunu aç" disabled={pending} data-testid="ramadan-toggle"
            onClick={() => save({ ramadan: !s.ramadan, sahur: r.sahur, iftar: r.iftar, ramadanUntil: r.until || null }, s.ramadan ? 'Ramazan modu kapatıldı' : 'Ramazan modu açıldı')}
            className="w-12 h-7 rounded-full bg-line-2 aria-checked:bg-[#FFD166] relative shrink-0 transition"><span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${s.ramadan ? 'left-[23px]' : 'left-[3px]'}`} /></button>
        </div>
        <span className="text-[12.5px] text-ink-2 leading-relaxed">Öğünler sahur ve iftar olur, su hedefi iftar ile sahur arasına yayılır, oruç saatlerinde hatırlatma gelmez. Vakitleri imsakiyeden gir.</span>
        {s.ramadan ? (
          <div className="flex flex-col gap-2" data-testid="ramadan-times">
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-[11.5px] font-bold text-ink-2">Sahur<input type="time" className="h-10 rounded-xl px-2 bg-surface/60 border border-line-2 text-[14px] num" value={r.sahur} onChange={(e) => setR({ ...r, sahur: e.target.value })} data-testid="ramadan-sahur" /></label>
              <label className="flex flex-col gap-1 text-[11.5px] font-bold text-ink-2">İftar<input type="time" className="h-10 rounded-xl px-2 bg-surface/60 border border-line-2 text-[14px] num" value={r.iftar} onChange={(e) => setR({ ...r, iftar: e.target.value })} data-testid="ramadan-iftar" /></label>
              <label className="flex flex-col gap-1 text-[11.5px] font-bold text-ink-2">Bayram<input type="date" className="h-10 rounded-xl px-1.5 bg-surface/60 border border-line-2 text-[12.5px] num min-w-0" value={r.until} min={today} onChange={(e) => setR({ ...r, until: e.target.value })} /></label>
            </div>
            <button type="button" disabled={pending} onClick={() => save({ sahur: r.sahur, iftar: r.iftar, ramadanUntil: r.until || null }, 'Saatler kaydedildi')} className="h-10 rounded-full border border-line-2 font-bold text-[13px]" data-testid="ramadan-save">Vakitleri kaydet</button>
          </div>
        ) : null}
      </section>

      <section aria-label="Diğer" className="card rounded-[20px] px-3.5 py-1 flex flex-col">
        <Link href="/profil/ozellestirme/kurallar" className={`${row} border-b border-line`}><span className="flex flex-col"><b className="text-[14px]">Zamana göre düzen</b><span className="text-[12px] text-mute">Sabah · gün içi · akşam</span></span><Status on={extra.time} /></Link>
        <Link href="/profil/ozellestirme/kurallar" className={`${row} border-b border-line`}><span className="flex flex-col"><b className="text-[14px]">Antrenman günü düzeni</b><span className="text-[12px] text-mute">Antrenman kartı en üste</span></span><Status on={extra.training} /></Link>
        <Link href="/profil/ozellestirme/kurallar" className={`${row} border-b border-line`} data-testid="modes-rules"><span className="flex flex-col"><b className="text-[14px]">Kurallarım</b><span className="text-[12px] text-mute">Eğer … ise → kart üste / gizle</span></span><span className="text-[13px] text-mute">{extra.rules} kural ›</span></Link>
        <Link href="/profil/ozellestirme/duzen#tek-el" className={row}><span className="flex flex-col"><b className="text-[14px]">Tek el modu</b><span className="text-[12px] text-mute">Düğmeler aşağıda{extra.hand ? ` · ${extra.hand === 'left' ? 'sol' : 'sağ'} el` : ''}</span></span><span className="text-[13px] text-mute">{extra.hand ? 'Açık' : 'Kapalı'} ›</span></Link>
      </section>
      {msg ? <p className="text-[13px] text-ink-2" role="status" data-testid="modes-msg">{msg}</p> : null}
    </div>
  )
}

function Status({ on }: { on: boolean }) {
  return <span data-mod="today" className={`text-[13px] font-bold ${on ? 'text-acc' : 'text-mute'}`}>{on ? 'Açık' : 'Kapalı'} ›</span>
}
