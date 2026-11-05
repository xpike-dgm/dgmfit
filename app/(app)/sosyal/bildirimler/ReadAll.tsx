'use client'
import { useRouter } from 'next/navigation'
import { hdrBtn } from '@/components/ui'
import { readAllAction } from '../actions'
export function ReadAll() {
  const router = useRouter()
  return <button type="button" className={hdrBtn} onClick={async () => { await readAllAction(); router.refresh() }}>Okundu say</button>
}
