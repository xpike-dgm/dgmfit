'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtNum } from '@/lib/calc'
import { shrinkImage } from '@/lib/client-image'
import { NUDGE } from '@/lib/social-rank'
import { nudgeAction, partnerAction, prVerifyAction } from '../../sosyal/actions'

type P = { mine: boolean; theirs: boolean; mutual: boolean }
type PR = { id: number; name: string; type: string; value: number; reason: string; witnesses: number; needed: number; hasProof: boolean }

/** Arkadaş profili: mesaj, dürtme, antrenman partneri (karşılıklı → bildirim + ortak program). */
export function FriendTools({ userId, username, partner }: { userId: string; username: string; partner: P }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <section className="card p-4 flex flex-col gap-2" aria-label="Arkadaş araçları" data-testid="friend-tools">
      <div className="flex flex-wrap gap-2">
        <Link href={`/sosyal/mesaj/${encodeURIComponent(username)}`} className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-bold inline-flex items-center">Mesaj</Link>
        {(Object.keys(NUDGE) as (keyof typeof NUDGE)[]).map((k) => (
          <button key={k} type="button" disabled={pending} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={() => start(async () => { const r = await nudgeAction(userId, k); setMsg(r.ok ? 'Dürttün 👋' : r.error) })}>{k === 'water' ? 'Su dürt 💧' : 'Antrenman dürt 💪'}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
        <span className="text-[13px] flex-1" data-testid="partner-status">{partner.mutual ? '🤝 Antrenman partnerisiniz' : partner.mine ? 'Partner isteğin gönderildi; o da seni işaretleyince etkinleşir' : partner.theirs ? 'Seni antrenman partneri olarak işaretledi' : 'Antrenman partneri: antrenman bitince birbirinize haber gider'}</span>
        <button type="button" disabled={pending} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={() => start(async () => { const r = await partnerAction(userId, partner.mine ? 'off' : 'on'); if (!r.ok) setMsg(r.error); router.refresh() })}>{partner.mine ? 'Partnerlikten çık' : partner.theirs ? 'Partner ol' : 'Partner yap'}</button>
        {partner.mutual ? <button type="button" disabled={pending} className="h-9 px-3 rounded-full bg-surface-2 text-[12px] font-bold" onClick={() => start(async () => { const r = await partnerAction(userId, 'copy'); if (r.ok && r.id) router.push(`/fitness/programlar/${r.id}`); else if (!r.ok) setMsg(r.error) })}>Ortak program: kopyala</button> : null}
      </div>
      {msg ? <p role="status" className="text-[13px] text-acc">{msg}</p> : null}
    </section>
  )
}

/** Doğrulama bekleyen şüpheli rekorlar: sahibi kanıt fotoğrafı ekler, arkadaşlar tanıklık eder. */
export function PendingPRs({ prs, self, canWitness }: { prs: PR[]; self: boolean; canWitness: boolean }) {
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  if (!prs.length) return null
  const proof = async (id: number, f: File) => {
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 1280, 0.82), 'kanit.jpg'); fd.set('kind', 'social')
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(j.error ?? 'Yüklenemedi'); return }
    const x = await prVerifyAction({ op: 'proof', prId: id, mediaId: j.id }); setMsg(x.ok ? 'Kanıt gönderildi; yönetici onayından sonra sıralamaya girer.' : x.error); router.refresh()
  }
  return (
    <section className="card p-4 flex flex-col gap-2 border border-orange/40" aria-label="Doğrulama bekleyen rekorlar" data-testid="pending-prs">
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-orange">Doğrulama bekleyen rekorlar</span>
      <p className="text-[12px] text-mute">Bu rekorlar sıralamalara girmez: {self ? '2 arkadaşın tanıklık etsin ya da kanıt fotoğrafı ekle (yönetici onaylar). Arkadaşlarının görüp tanıklık edebilmesi için PR vitrinini arkadaşlarına aç.' : 'gördüysen tanıklık edebilirsin.'}</p>
      {prs.map((p) => (
        <div key={p.id} className="flex items-center gap-2 min-h-11 border-b border-line last:border-0 flex-wrap" data-testid="pending-pr">
          <span className="flex-1 text-[14px]"><b>{p.name}</b> {fmtNum(p.value, p.value % 1 ? 1 : 0)} kg <span className="text-[12px] text-mute">· {p.reason} · tanık {p.witnesses}/{p.needed}{p.hasProof ? ' · kanıt var' : ''}</span></span>
          {self ? <label className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold inline-flex items-center cursor-pointer">Kanıt ekle<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void proof(p.id, f) }} /></label>
            : canWitness ? <button type="button" className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-bold" onClick={async () => { const r = await prVerifyAction({ op: 'witness', prId: p.id }); setMsg(r.ok ? (r.verified ? 'Rekor doğrulandı ✓' : 'Tanıklığın kaydedildi') : r.error); router.refresh() }}>Tanığım</button> : null}
        </div>
      ))}
      {msg ? <p role="status" className="text-[13px] text-acc">{msg}</p> : null}
    </section>
  )
}
