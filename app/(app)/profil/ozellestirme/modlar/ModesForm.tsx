'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MODES, type FocusMode, type ModeState } from '@/lib/modes'
import { modesAction } from '../actions'

export default function ModesForm({ s, today }: { s: ModeState; today: string }) {
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
  const inp = 'h-11 rounded-xl px-3 bg-surface-2 border border-line text-[15px]'
  return (
    <div className="flex flex-col gap-3" data-testid="modes-form">
      <section aria-label="Odak modu" className="card p-4 flex flex-col gap-3">
        <b className="text-[15px]">Odak modu</b>
        <p className="text-[12.5px] text-mute leading-snug">Mod; ekran düzenini, bildirimleri ve hedef gösterimini birlikte değiştirir. Kapatınca her şey eski hâline döner.</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Odak modu">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={s.focus === m.id} disabled={pending} onClick={() => pick(s.focus === m.id ? null : m.id)} data-testid={`mode-${m.id}`}
              className="text-left rounded-xl border border-line p-3 flex items-start gap-3 aria-checked:border-acc aria-checked:bg-acc/10">
              <span className="text-[22px] leading-none" aria-hidden>{m.emoji}</span>
              <span className="flex flex-col"><b className="text-[14.5px]">{m.label}</b><span className="text-[12.5px] text-mute leading-snug">{m.desc}</span></span>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 text-[13px] font-bold">Başlangıç
          <input type="date" className={inp} value={from} max={until || undefined} onChange={(e) => { setFrom(e.target.value); if (s.focus && e.target.value) save({ focusFrom: e.target.value }, 'Başlangıç kaydedildi') }} data-testid="mode-from" /></label>
        <label className="flex items-center justify-between gap-3 text-[13px] font-bold">Bitiş (isteğe bağlı)
          <input type="date" className={inp} value={until} min={today} onChange={(e) => { setUntil(e.target.value); if (s.focus) save({ focusUntil: e.target.value || null }, 'Bitiş kaydedildi') }} data-testid="mode-until" /></label>
        {s.focus ? <button type="button" disabled={pending} onClick={() => pick(null)} className="h-11 rounded-full border border-line-2 font-bold" data-testid="mode-off">Odak modunu kapat</button> : null}
      </section>

      <section aria-label="Ramazan modu" className="card p-4 flex flex-col gap-3">
        <span className="flex items-center justify-between gap-3">
          <span className="flex flex-col"><b className="text-[15px]">🌙 Ramazan modu</b><span className="text-[12.5px] text-mute leading-snug">Sahur / iftar öğünleri, su iftar–sahur arasında, oruçta hatırlatma yok, iftar sonrası protein kartı.</span></span>
          <button type="button" role="switch" aria-checked={s.ramadan} aria-label="Ramazan modu" disabled={pending} onClick={() => save({ ramadan: !s.ramadan, sahur: r.sahur, iftar: r.iftar, ramadanUntil: r.until || null }, s.ramadan ? 'Ramazan modu kapatıldı' : 'Ramazan modu açıldı')} data-testid="ramadan-toggle"
            className="w-12 h-7 rounded-full bg-surface-3 aria-checked:bg-acc relative shrink-0 transition"><span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${s.ramadan ? 'left-6' : 'left-1'}`} /></button>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-bold">Sahur (imsak)<input type="time" className={inp} value={r.sahur} onChange={(e) => setR({ ...r, sahur: e.target.value })} data-testid="ramadan-sahur" /></label>
          <label className="flex flex-col gap-1 text-[13px] font-bold">İftar<input type="time" className={inp} value={r.iftar} onChange={(e) => setR({ ...r, iftar: e.target.value })} data-testid="ramadan-iftar" /></label>
        </div>
        <label className="flex items-center justify-between gap-3 text-[13px] font-bold">Bayram (bitiş)<input type="date" className={inp} value={r.until} min={today} onChange={(e) => setR({ ...r, until: e.target.value })} /></label>
        <button type="button" disabled={pending} onClick={() => save({ sahur: r.sahur, iftar: r.iftar, ramadanUntil: r.until || null }, 'Saatler kaydedildi')} className="h-11 rounded-full border border-line-2 font-bold" data-testid="ramadan-save">Saatleri kaydet</button>
        <p className="text-[12px] text-mute leading-snug">Saatler şehrine göre her gün birkaç dakika değişir; imsakiyeden bakıp ara ara güncelleyebilirsin.</p>
      </section>
      {msg ? <p className="text-[13px] text-ink-2" role="status" data-testid="modes-msg">{msg}</p> : null}
    </div>
  )
}
