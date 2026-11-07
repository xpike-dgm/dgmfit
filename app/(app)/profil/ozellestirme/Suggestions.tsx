'use client'
// Ö4: koç önerileri (kullanım verisinden) — onayla ya da "şimdi değil".
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Suggestion } from '@/lib/cards/usage'
import { suggestionAction } from './actions'

export default function Suggestions({ list }: { list: Suggestion[] }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const run = (input: Record<string, unknown>, done: string) => start(async () => { const r = await suggestionAction(input).catch(() => null); setMsg(r?.ok ? done : r && !r.ok ? r.error : 'Olmadı'); if (r?.ok) router.refresh() })
  if (!list.length) return null
  return (
    <section aria-label="Koç önerileri" className="rounded-[24px] p-4 flex flex-col gap-2 bg-coach border border-coach-line" data-testid="suggestions">
      <b className="text-[15px]">Koç önerisi</b>
      {list.map((s) => (
        <div key={s.id} className="flex flex-col gap-1.5 py-1" data-suggestion={s.id}>
          <span className="text-[14px] font-bold">{s.text}</span>
          <span className="text-[12.5px] text-ink-2">{s.reason}</span>
          <span className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => run({ op: 'apply', screen: s.screen, card: s.card, kind: s.kind }, 'Öneri uygulandı')} className="h-9 px-4 rounded-full bg-acc text-acc-ink text-[13px] font-extrabold" data-testid="suggestion-apply">{s.kind === 'up' ? 'Üste al' : 'Kaldır'}</button>
            <button type="button" disabled={pending} onClick={() => run({ op: 'dismiss', id: s.id }, 'Bu öneriyi bir daha göstermeyeceğiz')} className="h-9 px-3 rounded-full text-[13px] font-bold text-mute" data-testid="suggestion-dismiss">Şimdi değil</button>
          </span>
        </div>
      ))}
      {msg ? <p role="status" className="text-[12.5px] font-bold text-ink-2">{msg}</p> : null}
    </section>
  )
}
