'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetLayoutAction } from './actions'

export default function ResetButton({ screen }: { screen: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <button type="button" disabled={pending} onClick={() => { if (confirm('Bu ekran varsayılan düzene dönsün mü?')) start(async () => { await resetLayoutAction(screen); router.refresh() }) }}
      className="h-10 px-3 text-[13px] font-bold text-mute" data-testid="studio-reset">Varsayılana dön</button>
  )
}
