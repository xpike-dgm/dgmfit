'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { trackNav } from './BackButton'
import { hidesNav, isFocusPage, moduleFor } from '@/lib/theme'

/** Bulunulan modülün renk paletini (`data-mod`) alt ağaca uygular. Sunucu çiziminde de doğru değer gelir. */
export default function ModShell({ children, className, hand, attrs, style }: { children: React.ReactNode; className?: string; hand?: 'left' | 'right' | null; attrs?: Record<string, string>; style?: Record<string, string> }) {
  const path = usePathname()
  const sp = useSearchParams()
  const q = sp.toString()
  useEffect(() => { trackNav(path + (q ? '?' + q : '')) }, [path, q])
  return <div {...attrs} style={style as React.CSSProperties | undefined} data-mod={moduleFor(path)} data-shell="" data-hand={hand ?? undefined} className={`${className ?? ''} ${isFocusPage(path) ? '!pb-0' : hidesNav(path) ? '!pb-[calc(28px+env(safe-area-inset-bottom))]' : ''}`}>{children}</div>
}
