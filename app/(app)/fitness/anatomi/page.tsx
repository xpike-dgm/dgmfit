import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { anatomyViews, muscleCounts } from '@/lib/anatomy-data'
import { getToday } from '@/lib/today'
import { TopBar } from '@/components/ui'
import AnatomyExplorer from './AnatomyExplorer'

export const metadata: Metadata = { title: 'Kas haritası · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const views = anatomyViews()
  if (!views) return <div className="px-4 flex flex-col gap-3"><TopBar back="/fitness" title="Kas haritası" /><p className="card p-5 text-[14px] text-mute">Kas haritası şu an kullanılamıyor.</p></div>
  const [t, counts] = await Promise.all([getToday(u.id), muscleCounts()])
  return <AnatomyExplorer views={views} counts={counts} initialGender={t?.profile.sex === 'female' ? 'female' : 'male'} />
}
