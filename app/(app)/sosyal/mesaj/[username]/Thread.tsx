'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORT } from '@/lib/safety'
import { sendDMAction } from '../../actions'

type M = { id: number; mine: boolean; body: string; flagged: string | null; post: { id: string; author: string; kind: string; body: string } | null; createdAt: string }

export default function Thread({ username, canSend, messages }: { username: string; canSend: boolean; messages: M[] }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [support, setSupport] = useState<'ed' | 'crisis' | null>(null)
  const [shown, setShown] = useState<number[]>([])
  const [pending, start] = useTransition()
  const end = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length])
  return (
    <div className="flex flex-col gap-3" data-testid="thread">
      <ul className="flex flex-col gap-2">{messages.map((m) => (
        <li key={m.id} className={`max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-[15px] ${m.mine ? 'self-end bg-acc text-acc-ink' : 'self-start bg-surface-2'}`} data-testid="dm">
          {m.flagged && !m.mine && !shown.includes(m.id) ? <button type="button" className="text-[13px] text-orange underline" onClick={() => setShown([...shown, m.id])}>Bu mesaj uygunsuz olabilir · göster</button> : m.body ? <span className="whitespace-pre-wrap">{m.body}</span> : null}
          {m.post ? <Link href={`/sosyal/p/${m.post.id}`} className={`mt-1 block rounded-xl px-3 py-2 text-[13px] ${m.mine ? 'bg-acc-ink/10' : 'bg-surface'}`} data-testid="dm-post">📎 {m.post.author}: {m.post.body || m.post.kind}</Link> : m.post === null && m.body === '' ? <span className="text-[13px] text-mute">Gönderi artık görünmüyor</span> : null}
        </li>
      ))}</ul>
      <div ref={end} />
      {support ? <p className="text-[13px] text-water">{SUPPORT[support].body}</p> : null}
      {canSend ? (
        <form className="sticky bottom-[calc(12px+env(safe-area-inset-bottom))] bg-bg pt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; start(async () => { const r = await sendDMAction({ to: username, body: text }); if (!r.ok) { setErr(r.error); return } setText(''); setSupport(r.support); router.refresh() }) }}>
          <label htmlFor="dm-input" className="sr-only">Mesaj</label>
          <input id="dm-input" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yaz…" className="flex-1 h-12 rounded-full bg-surface-2 border border-line px-4" />
          <button type="submit" disabled={pending || !text.trim()} className="h-12 px-5 rounded-full bg-acc text-acc-ink font-bold disabled:opacity-40">Gönder</button>
        </form>
      ) : <p className="text-[13px] text-mute">Yalnızca arkadaşlarınla mesajlaşabilirsin.</p>}
      {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
    </div>
  )
}

/** Gönderiyi mesajla paylaş: arkadaş seç. */
export function SharePost({ postId, friends }: { postId: string; friends: string[] }) {
  const [done, setDone] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  return (
    <section className="card p-4 flex flex-col gap-2" data-testid="share-dm">
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Gönderiyi mesajla paylaş</span>
      <div className="flex flex-wrap gap-1.5">{friends.map((f) => (
        <button key={f} type="button" disabled={done.includes(f)} onClick={async () => { const r = await sendDMAction({ to: f, body: '', postId }); if (r.ok) setDone([...done, f]); else setErr(r.error) }} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${done.includes(f) ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{done.includes(f) ? `✓ ${f}` : f}</button>
      ))}</div>
      {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
    </section>
  )
}
