'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import BodyFigure from '@/components/BodyFigure'
import BackButton from '@/components/BackButton'
import { FemaleSign, Heart, MaleSign, Rotate } from '@/components/icons'
import { SELECT_COLOR, viewKey, type Gender, type Side } from '@/lib/anatomy'
import type { AnatomyView } from '@/lib/anatomy-data'

const round = 'w-14 h-14 rounded-full bg-white text-[#14161B] flex items-center justify-center shadow-lg active:scale-95 transition'

/** Tam ekran anatomi: cinsiyet ve ön/arka değiştir, kasa dokun → o kasın hareket akışı. */
export default function AnatomyExplorer({ views, counts, initialGender }: { views: Record<string, AnatomyView>; counts: Record<string, number>; initialGender: Gender }) {
  const router = useRouter()
  const [gender, setGender] = useState<Gender>(initialGender)
  const [side, setSide] = useState<Side>('front')
  const [sel, setSel] = useState<string | null>(null)
  const view = views[viewKey(gender, side)] ?? Object.values(views)[0]
  function pick(k: string) {
    if (!counts[k] || sel) return // çift dokunuşta iki kez yönlendirme olmasın
    setSel(k)
    setTimeout(() => router.push(`/fitness/anatomi/${k}?g=${gender}`), 260)
  }
  return (
    <div className="fixed inset-0 z-30 bg-black text-white flex flex-col safe-top" data-testid="anatomy">
      <div className="absolute left-4 top-4 safe-top flex flex-col gap-3 z-10">
        <BackButton fallback="/fitness" className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center" />
        <button type="button" className={round} aria-label={gender === 'male' ? 'Kadın figürüne geç' : 'Erkek figürüne geç'} onClick={() => setGender(gender === 'male' ? 'female' : 'male')} data-testid="gender-toggle">
          {gender === 'male' ? <MaleSign size={26} /> : <FemaleSign size={26} />}
        </button>
        <button type="button" className={round} aria-label={side === 'front' ? 'Arkadan göster' : 'Önden göster'} onClick={() => setSide(side === 'front' ? 'back' : 'front')} data-testid="side-toggle"><Rotate size={24} /></button>
      </div>
      <Link href="/fitness/kaydedilenler" className="absolute right-4 top-4 safe-top z-10 w-14 h-14 flex items-center justify-center" aria-label="Kaydedilen hareketler"><Heart size={34} filled /></Link>
      <div className="flex-1 min-h-0 flex items-center justify-center px-6 pt-2 pb-24">
        <BodyFigure view={view} fills={sel ? { [sel]: SELECT_COLOR } : {}} onSelect={pick} className="h-full w-auto max-w-full" label={`${gender === 'male' ? 'Erkek' : 'Kadın'} ${side === 'front' ? 'ön' : 'arka'} kas haritası; bir kasa dokun`} />
      </div>
      <p className="absolute bottom-24 left-0 right-0 text-center text-[13px] text-white/60 pointer-events-none">Bir kasa dokun, o kası çalıştıran hareketler açılsın</p>
    </div>
  )
}
