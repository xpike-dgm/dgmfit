'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { Check, Ticket, Trash } from '@/components/icons'
import { createInviteAction, inviteDeleteAction, inviteToggleAction } from '../actions'
import { ask } from '@/components/Confirm'

interface Inv { code: string; label: string; maxUses: number | null; uses: number; expiresAt: string | null; disabled: boolean; usable: boolean; createdAt: string }
const field = 'w-full h-12 rounded-2xl bg-surface-2 border border-line px-4 text-[16px] outline-none focus:border-acc'
const day = (s: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short' }).format(new Date(s))

export default function Invites({ list, origin }: { list: Inv[]; origin: string }) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [uses, setUses] = useState('1')
  const [days, setDays] = useState('7')
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const link = (c: string) => `${origin}/kayit?davet=${encodeURIComponent(c)}`
  async function copy(c: string) {
    try {
      if (navigator.share) await navigator.share({ title: 'DgFit daveti', text: `DgFit'e davetlisin. Kod: ${c}`, url: link(c) })
      else { await navigator.clipboard.writeText(link(c)); setCopied(c); setTimeout(() => setCopied(null), 1800) }
    } catch { /* iptal */ }
  }
  return (
    <>
      <section className="card p-4 flex flex-col gap-3" aria-label="Yeni davet kodu">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold"><Ticket size={18} /> Yeni kod</h2>
        <input className={field} placeholder="Kime / ne için (ör. Spor salonu arkadaşları)" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 60))} aria-label="Etiket" />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12.5px] font-bold text-mute">Kullanım hakkı
            <input className={field + ' num'} inputMode="numeric" placeholder="sınırsız" value={uses} onChange={(e) => setUses(e.target.value.replace(/\D/g, '').slice(0, 5))} id="inv-uses" /></label>
          <label className="flex flex-col gap-1 text-[12.5px] font-bold text-mute">Geçerlilik (gün)
            <input className={field + ' num'} inputMode="numeric" placeholder="süresiz" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))} id="inv-days" /></label>
        </div>
        <button type="button" className={btn.primary + ' h-12 text-[15px]'} disabled={pending} data-testid="create-invite"
          onClick={() => start(async () => { const r = await createInviteAction(label, uses, days); if (!r.ok) { setErr(r.error); return } setErr(null); setCreated(r.code ?? null); setLabel(''); router.refresh() })}>Kod oluştur</button>
        {err ? <p role="status" className="text-[13px] font-semibold text-danger">{err}</p> : null}
        {created ? (
          <div className="rounded-2xl bg-acc/10 border border-acc/40 p-3 flex flex-col gap-2" role="status">
            <span className="text-[12.5px] font-bold text-acc">Kod hazır · paylaş</span>
            <b className="num text-[24px] tracking-[0.12em]" data-testid="new-code">{created}</b>
            <button type="button" className={btn.secondary} onClick={() => copy(created)}>{copied === created ? <><Check size={16} /> Bağlantı kopyalandı</> : 'Bağlantıyı paylaş / kopyala'}</button>
          </div>
        ) : null}
      </section>
      <section className="flex flex-col gap-2" aria-label="Kodlar">
        <h2 className="text-[13px] font-bold tracking-[0.06em] uppercase text-mute px-1">Kodlar ({list.length})</h2>
        {list.length ? list.map((i) => (
          <article key={i.code} className={`card p-4 flex flex-col gap-2 ${i.usable ? '' : 'opacity-70'}`} data-testid="invite-row">
            <div className="flex items-center justify-between gap-2">
              <b className="num text-[17px] tracking-[0.06em] break-all">{i.code}</b>
              <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${i.usable ? 'bg-good/15 text-good' : 'bg-surface-3 text-mute'}`}>{i.usable ? 'Etkin' : i.disabled ? 'Kapalı' : 'Bitti'}</span>
            </div>
            <span className="text-[13px] text-ink-2 truncate">{i.label || 'Etiketsiz'}</span>
            <span className="text-[12px] text-mute num">{i.uses}{i.maxUses !== null ? ` / ${i.maxUses}` : ''} kullanım · {i.expiresAt ? `${day(i.expiresAt)} tarihine kadar` : 'süresiz'} · {day(i.createdAt)} oluşturuldu</span>
            <div className="flex gap-2 flex-wrap">
              {i.usable ? <button type="button" className="h-9 px-3.5 rounded-full border border-line-2 text-[13px] font-bold" onClick={() => copy(i.code)}>{copied === i.code ? 'Kopyalandı' : 'Paylaş'}</button> : null}
              <button type="button" disabled={pending} className="h-9 px-3.5 rounded-full border border-line-2 text-[13px] font-bold" onClick={() => start(async () => { await inviteToggleAction(i.code, !i.disabled); router.refresh() })}>{i.disabled ? 'Aç' : 'Kapat'}</button>
              <button type="button" disabled={pending} aria-label="Kodu sil" className="h-9 w-9 rounded-full border border-line-2 text-danger flex items-center justify-center ml-auto" onClick={async () => (await ask(`${i.code} silinsin mi?`)) && start(async () => { await inviteDeleteAction(i.code); router.refresh() })}><Trash size={16} /></button>
            </div>
          </article>
        )) : <p className="card p-4 text-[14px] text-mute">Henüz kod yok. Kod olmadan kayıt olanlar onay listesine düşer.</p>}
      </section>
    </>
  )
}
