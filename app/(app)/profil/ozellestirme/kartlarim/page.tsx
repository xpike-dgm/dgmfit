import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { SCREENS, type ScreenId } from '@/lib/cards/registry'
import { USER_CARDS_MAX } from '@/lib/cards/custom'
import { listTrackers, listUserCards } from '@/lib/cards/custom-data'
import Builder from './Builder'

export const metadata = { title: 'Kart oluşturucu' }

/** Ö5a: kart oluşturucu — veri kaynağı + görünüm + ekran seç; kart düzenine eklenir, renkleri ✎ ile değişir. */
export default async function Page(props: { searchParams: Promise<{ kart?: string }> }) {
  const u = await requireUser()
  const [cards, trackers] = await Promise.all([listUserCards(u.id), listTrackers(u.id)])
  const { kart } = await props.searchParams
  const screens = (Object.keys(SCREENS) as ScreenId[]).map((s) => ({ id: s, title: SCREENS[s].title, path: SCREENS[s].path }))
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="card-builder">
      <TopBar back="/profil/ozellestirme" title="Kart oluşturucu" sub={`${cards.length} / ${USER_CARDS_MAX} kendi kartın`} />
      <p className="text-[13px] text-mute leading-relaxed">Bir veri seç (su, kalori, kilo, kendi takip alanın…), nasıl görüneceğini ve hangi ekranda duracağını belirle. Söz, geri sayım ve motivasyon fotoğrafı kartları da yapabilirsin. Uygulamada olmayan bir şeyi mi ölçeceksin? Önce <Link href="/profil/ozellestirme/takip" className="font-bold text-acc">takip alanı</Link> ekle.</p>
      <Builder cards={cards} trackers={trackers.map((t) => ({ id: t.id, name: t.name, unit: t.unit, emoji: t.emoji }))} screens={screens} edit={kart ?? null} />
    </div>
  )
}
