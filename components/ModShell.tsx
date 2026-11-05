'use client'
import { usePathname } from 'next/navigation'
import { moduleFor } from '@/lib/theme'

/** Bulunulan modülün renk paletini (`data-mod`) alt ağaca uygular. Sunucu çiziminde de doğru değer gelir. */
export default function ModShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const path = usePathname()
  return <div data-mod={moduleFor(path)} data-shell="" className={className}>{children}</div>
}
