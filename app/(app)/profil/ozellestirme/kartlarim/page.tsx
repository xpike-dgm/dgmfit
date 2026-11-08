import { requireUser } from '@/lib/auth'
import StudioHeader from '@/components/cards/StudioHeader'
import { Group, Lead, Row } from '@/components/cards/StudioUI'
import { SCREENS, type ScreenId } from '@/lib/cards/registry'
import { USER_CARDS_MAX } from '@/lib/cards/custom'
import { listTrackers, listUserCards } from '@/lib/cards/custom-data'
import Builder from './Builder'

export const metadata = { title: 'Kendi kartlarım' }

/** Ö5a / G1: kendi kartların — liste + "Yeni kart" alt penceresi; takip alanları ayrı satır. */
export default async function Page(props: { searchParams: Promise<{ kart?: string }> }) {
  const u = await requireUser()
  const [cards, trackers] = await Promise.all([listUserCards(u.id), listTrackers(u.id)])
  const { kart } = await props.searchParams
  const screens = (Object.keys(SCREENS) as ScreenId[]).map((s) => ({ id: s, title: SCREENS[s].title, path: SCREENS[s].path }))
  return (
    <div className="px-4 flex flex-col gap-4 pb-6" data-testid="card-builder" data-mod="today">
      <StudioHeader back="/profil/ozellestirme" title="Kendi kartlarım" right={<span className="num text-[13px] font-bold text-mute pr-2">{cards.length}/{USER_CARDS_MAX}</span>} />
      <Lead>Bir veri seç, nasıl görüneceğini ve hangi ekranda duracağını belirle.</Lead>
      <Builder cards={cards} trackers={trackers.map((t) => ({ id: t.id, name: t.name, unit: t.unit, emoji: t.emoji }))} screens={screens} edit={kart ?? null} />
      <Group label="Veri" footer="Uygulamada olmayan bir şeyi mi ölçeceksin (kahve, uyku, ruh hali)? Önce takip alanı ekle, sonra onunla kart yap.">
        <Row href="/profil/ozellestirme/takip" icon="tracker" mod="plan" title="Takip alanlarım" sub={trackers.length ? `${trackers.length} takip alanı` : 'Kahve, uyku, ruh hali…'} testId="studio-trackers" />
      </Group>
    </div>
  )
}
