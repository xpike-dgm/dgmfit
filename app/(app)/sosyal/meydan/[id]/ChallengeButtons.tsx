'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { respondChallengeAction } from '../../actions'
export function ChallengeButtons({ id, status, ended }: { id: string; status: string; ended: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (s: 'joined' | 'declined' | 'left') => start(async () => { await respondChallengeAction(id, s); if (s === 'joined') router.refresh(); else router.push('/sosyal/meydan') })
  if (ended) return null
  if (status === 'invited') return <div className="flex gap-2"><button type="button" disabled={pending} onClick={() => go('joined')} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold">Katıl</button><button type="button" disabled={pending} onClick={() => go('declined')} className="h-12 px-5 rounded-full border border-line-2 font-bold">Reddet</button></div>
  return <button type="button" disabled={pending} onClick={() => { if (confirm('Meydan okumadan ayrılınsın mı?')) go('left') }} className="self-start h-10 px-4 rounded-full border border-line-2 text-[13px] font-bold">Ayrıl</button>
}
