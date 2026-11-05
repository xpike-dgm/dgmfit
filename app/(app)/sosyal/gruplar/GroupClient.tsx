'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { SUPPORT } from '@/lib/safety'
import { groupAction } from '../actions'

export function NewGroup() {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <form className="card p-4 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await groupAction({ op: 'create', name, description: desc }); if (!r.ok) { setErr(r.error); return } router.push(`/sosyal/gruplar/${r.id}`) }) }}>
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Yeni grup</span>
      <label htmlFor="g-name" className="sr-only">Grup adı</label>
      <input id="g-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Grup adı (ör. Sabah salonu)" className="h-12 rounded-xl bg-surface-2 border border-line px-3" />
      <label htmlFor="g-desc" className="sr-only">Açıklama</label>
      <input id="g-desc" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Açıklama (isteğe bağlı)" className="h-12 rounded-xl bg-surface-2 border border-line px-3" />
      {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
      <button type="submit" className={btn.primary} disabled={pending || name.trim().length < 2}>Grup oluştur</button>
    </form>
  )
}

export function GroupOp({ op, groupId, userId, label, tone = 'secondary', confirmText, after }: { op: 'invite' | 'accept' | 'decline' | 'leave' | 'remove' | 'optin' | 'optout'; groupId: string; userId?: string; label: string; tone?: 'primary' | 'secondary' | 'danger'; confirmText?: string; after?: string }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()
  const cls = tone === 'primary' ? 'bg-acc text-acc-ink' : tone === 'danger' ? 'border border-line-2 text-danger' : 'border border-line-2'
  return <>
    <button type="button" disabled={pending} className={`h-9 px-3 rounded-full text-[12px] font-bold ${cls}`} onClick={() => start(async () => {
      if (confirmText && !confirm(confirmText)) return
      const r = await groupAction({ op, groupId, userId }); if (!r.ok) { setErr(r.error); return }
      if (after) router.push(after); else router.refresh()
    })}>{label}</button>
    {err ? <span role="alert" className="text-[12px] text-orange">{err}</span> : null}
  </>
}

export function GroupChat({ groupId, messages }: { groupId: string; messages: { id: number; username: string; body: string; flagged: string | null; mine: boolean; createdAt: string }[] }) {
  const [text, setText] = useState('')
  const [shown, setShown] = useState<number[]>([])
  const [support, setSupport] = useState<'ed' | 'crisis' | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <section className="card p-4 flex flex-col gap-2" aria-label="Grup sohbeti" data-testid="group-chat">
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Sohbet</span>
      <ul className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">{messages.map((m) => (
        <li key={m.id} className={`text-[14px] rounded-2xl px-3 py-2 ${m.mine ? 'bg-acc/15 self-end' : 'bg-surface-2 self-start'}`} data-testid="group-msg">
          <b className="text-[12px] block">{m.username}</b>
          {m.flagged && !m.mine && !shown.includes(m.id) ? <button type="button" className="text-[12px] text-orange underline" onClick={() => setShown([...shown, m.id])}>Uygunsuz olabilir · göster</button> : <span className="whitespace-pre-wrap">{m.body}</span>}
        </li>
      ))}</ul>
      {support ? <p className="text-[13px] text-water">{SUPPORT[support].body}</p> : null}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; start(async () => { const r = await groupAction({ op: 'message', groupId, body: text }); if (r.ok) { setText(''); setSupport(r.support ?? null); router.refresh() } }) }}>
        <label htmlFor="g-msg" className="sr-only">Mesaj</label>
        <input id="g-msg" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Gruba yaz…" className="flex-1 h-11 rounded-full bg-surface-2 border border-line px-4" />
        <button type="submit" disabled={pending || !text.trim()} className="h-11 px-4 rounded-full bg-acc text-acc-ink font-bold disabled:opacity-40">Gönder</button>
      </form>
    </section>
  )
}
