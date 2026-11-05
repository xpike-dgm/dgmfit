'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { trackNav } from './BackButton'
import { moduleFor } from '@/lib/theme'

/** Bulunulan modülün renk paletini (`data-mod`) alt ağaca uygular. Sunucu çiziminde de doğru değer gelir. */
export default function ModShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const path = usePathname()
  const sp = useSearchParams()
  const q = sp.toString()
  useEffect(() => { trackNav(path + (q ? '?' + q : '')) }, [path, q])
  return <div data-mod={moduleFor(path)} data-shell="" className={className}>{children}</div>
}
