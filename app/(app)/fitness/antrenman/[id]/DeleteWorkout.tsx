'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { deleteWorkoutAction } from '../../actions'

export default function DeleteWorkout({ id }: { id: string }) {
  const [ask, setAsk] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  if (!ask) return <button type="button" className={`${btn.ghost} text-mute`} onClick={() => setAsk(true)}>Antrenmanı sil</button>
  return (
    <div className="flex gap-2 justify-center pb-4">
      <button type="button" className={`${btn.secondary} text-danger`} disabled={pending} onClick={() => start(async () => { const r = await deleteWorkoutAction(id); if (r.ok) router.push('/fitness') })}>Evet, sil</button>
      <button type="button" className={btn.ghost} onClick={() => setAsk(false)}>Vazgeç</button>
    </div>
  )
}
