'use client'
// Ö3c: topluluk işlemleri için tek düğme (katıl, oy ver, takip, grup teması, duyuru kapat…).
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { communityAction } from './actions'

export default function CommunityButton({ input, label, done, className, testId, confirmText }: { input: Record<string, unknown>; label: string; done: string; className?: string; testId?: string; confirmText?: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={pending} data-testid={testId} className={className ?? 'h-10 px-4 rounded-full bg-acc text-acc-ink text-[13px] font-extrabold disabled:opacity-50'}
        onClick={() => { if (confirmText && !confirm(confirmText)) return; start(async () => { const r = await communityAction(input).catch(() => null); setMsg(r?.ok ? done : r && !r.ok ? r.error : 'Olmadı'); if (r?.ok) router.refresh() }) }}>{label}</button>
      {msg ? <span role="status" className="text-[12px] font-bold text-ink-2">{msg}</span> : null}
    </span>
  )
}
