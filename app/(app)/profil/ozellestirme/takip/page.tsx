import { requireUser } from '@/lib/auth'
import StudioHeader from '@/components/cards/StudioHeader'
import { TRACKERS_MAX, listTrackers } from '@/lib/cards/custom-data'
import Trackers from './Trackers'

export const metadata = { title: 'Takip alanlarım' }

/** Ö5a: kendi takip alanlarım — kahve, uyku, ruh hali gibi uygulamada olmayan her şey; kart oluşturucuda karta dönüşür. */
export default async function Page() {
  const u = await requireUser()
  const list = await listTrackers(u.id)
  return (
    <div className="px-4 flex flex-col gap-4 pb-6" data-testid="trackers" data-mod="today">
      <StudioHeader back="/profil/ozellestirme/kartlarim" title="Takip alanlarım" right={<span className="num text-[13px] font-bold text-mute pr-2">{list.length}/{TRACKERS_MAX}</span>} />
      <Trackers list={list} />
    </div>
  )
}
