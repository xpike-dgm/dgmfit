'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moderateAction } from '../../sosyal/actions'
export function ModButton({ type, id, approve, label }: { type: 'post' | 'comment' | 'report'; id: string; approve: boolean; label: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return <button type="button" disabled={pending} className={`h-9 px-3 rounded-full text-[12px] font-bold ${approve ? 'bg-lime text-lime-ink' : 'border border-line-2 text-danger'}`} onClick={() => start(async () => { await moderateAction({ type, id, approve }); router.refresh() })}>{label}</button>
}
