// Ö6: özelleştirme sayfalarının sade başlığı (tasarım: geri oku + Space Grotesk başlık, bant yok). Üst öğe `px-4` olmalı.
import type { ReactNode } from 'react'
import BackButton from '@/components/BackButton'

export default function StudioHeader({ title, back, right }: { title: ReactNode; back: string; right?: ReactNode }) {
  return (
    <header className="-mx-4 px-3 pt-3.5 pb-1.5 safe-top flex items-center gap-2" data-testid="studio-header">
      <BackButton fallback={back} className="w-11 h-11 rounded-full inline-flex items-center justify-center text-ink shrink-0" />
      <h1 className="num flex-1 min-w-0 text-[22px] font-bold leading-tight truncate">{title}</h1>
      {right ?? null}
    </header>
  )
}

/** Bölüm etiketi (tasarım: büyük harf, gri, aralıklı). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-mute">{children}</span>
}
