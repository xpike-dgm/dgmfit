'use client'
import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ask } from '@/components/Confirm'

type R = { ok: true; msg?: string } | { ok: false; error: string }
/** Tek tıkla sunucu eylemi; sonucu altında gösterir. `confirm` verilirse önce sorar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ActionButton<A extends any[]>({ action, args, children, className, confirm, testId }: { action: (...a: A) => Promise<R>; args: A; children: ReactNode; className: string; confirm?: string; testId?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<R | null>(null)
  return (
    <span className="inline-flex flex-col gap-1 min-w-0">
      <button type="button" data-testid={testId} disabled={pending} className={className + (pending ? ' opacity-60' : '')}
        onClick={async (e) => { e.preventDefault(); e.stopPropagation(); if (confirm && !(await ask(confirm))) return; start(async () => { const r = await action(...args); setMsg(r); router.refresh() }) }}>
        {children}
      </button>
      {msg ? <span role="status" className={`text-[12px] font-semibold ${msg.ok ? 'text-good' : 'text-danger'}`}>{msg.ok ? msg.msg ?? 'Tamam' : msg.error}</span> : null}
    </span>
  )
}
