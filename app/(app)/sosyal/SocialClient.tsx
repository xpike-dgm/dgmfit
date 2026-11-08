'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { friendAction } from './actions'
import { ask } from '@/components/Confirm'

type Op = Parameters<typeof friendAction>[0]['op']
const RESULT: Record<string, string> = { sent: 'İstek gönderildi', accepted: 'Artık arkadaşsınız', already: 'Zaten gönderildi' }

export function SuggestButton({ username }: { username: string }) {
  const [state, setState] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (state) return <span className="text-[12px] text-acc">{state}</span>
  return <button type="button" disabled={pending} className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-bold" onClick={() => start(async () => { const r = await friendAction({ op: 'request', username }); setState(r.ok ? RESULT[r.result ?? 'sent'] : r.error) })}>Arkadaş ekle</button>
}

/** Genel ilişki düğmesi: işlem sonrası sayfayı yeniler. */
export function RelButton({ op, id, username, label, tone = 'secondary', confirmText }: { op: Op; id?: string; username?: string; label: string; tone?: 'primary' | 'secondary' | 'danger'; confirmText?: string }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()
  const cls = tone === 'primary' ? 'bg-acc text-acc-ink' : tone === 'danger' ? 'border border-line-2 text-danger' : 'border border-line-2'
  return (
    <>
      <button type="button" disabled={pending} className={`h-9 px-3 rounded-full text-[12px] font-bold ${cls}`} onClick={() => start(async () => {
        if (confirmText && !(await ask(confirmText))) return
        const r = await friendAction({ op, id, username })
        if (!r.ok) setErr(r.error); else router.refresh()
      })}>{label}</button>
      {err ? <span role="alert" className="text-[12px] text-orange">{err}</span> : null}
    </>
  )
}
