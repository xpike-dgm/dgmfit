import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { TRACKERS_MAX, listTrackers } from '@/lib/cards/custom-data'
import Trackers from './Trackers'

export const metadata = { title: 'Takip alanlarım' }

/** Ö5a: kendi takip alanlarım — kahve, uyku, ruh hali gibi uygulamada olmayan her şey; kart oluşturucuda karta dönüşür. */
export default async function Page() {
  const u = await requireUser()
  const list = await listTrackers(u.id)
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="trackers">
      <TopBar back="/profil/ozellestirme" title="Takip alanlarım" sub={`${list.length} / ${TRACKERS_MAX} · kendi ölçtüğün şeyler`} />
      <Trackers list={list} />
    </div>
  )
}
