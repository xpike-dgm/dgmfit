'use client'
import { useRouter } from 'next/navigation'
import { readAllAction } from '../actions'
export function ReadAll() {
  const router = useRouter()
  return <button type="button" className="h-11 px-3 rounded-full bg-surface-2 text-[13px] font-bold" onClick={async () => { await readAllAction(); router.refresh() }}>Tümünü okundu say</button>
}
