'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { commentAction, deleteCommentAction, reportAction } from '../../actions'

type C = { id: string; body: string; username: string; mine: boolean; canDelete: boolean; pending: boolean; createdAt: string }

export default function Comments({ postId, comments }: { postId: string; comments: C[] }) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Yorumlar" data-testid="comments">
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Yorumlar ({comments.length})</span>
      <ul className="flex flex-col gap-2">{comments.map((c) => (
        <li key={c.id} className="flex flex-col gap-0.5 border-b border-line last:border-0 pb-2" data-testid="comment">
          <span className="text-[13px]"><Link href={`/u/${c.username}`} className="font-bold">{c.username}</Link> <span className="whitespace-pre-wrap">{c.body}</span></span>
          <span className="flex gap-3 text-[11px] text-mute">
            {c.pending ? <span className="text-orange">İnceleme bekliyor (yalnızca sen görüyorsun)</span> : null}
            {c.canDelete ? <button type="button" className="underline" onClick={() => start(async () => { await deleteCommentAction(c.id, postId); router.refresh() })}>Sil</button> : null}
            {!c.mine ? <button type="button" className="underline" onClick={async () => { const r = await reportAction({ targetType: 'comment', targetId: c.id, reason: 'taciz' }); setMsg(r.ok ? 'Şikayetin alındı.' : r.error) }}>Şikayet et</button> : null}
          </span>
        </li>
      ))}</ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; start(async () => { const r = await commentAction(postId, text); if (!r.ok) { setMsg(r.error); return } setText(''); setMsg(r.pending ? 'Yorumun incelemeye alındı.' : null); router.refresh() }) }}>
        <label htmlFor="comment-input" className="sr-only">Yorum yaz</label>
        <input id="comment-input" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Yorum yaz…" className="flex-1 h-11 rounded-full bg-surface-2 border border-line px-4" />
        <button type="submit" disabled={pending || !text.trim()} className="h-11 px-4 rounded-full bg-acc text-acc-ink font-bold disabled:opacity-40">Gönder</button>
      </form>
      {msg ? <p role="status" className="text-[13px] text-ink-2">{msg}</p> : null}
    </section>
  )
}
