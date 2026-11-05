import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { anatomyViews, favoriteFeed } from '@/lib/anatomy-data'
import { getToday } from '@/lib/today'
import { TopBar } from '@/components/ui'
import ExerciseFeed from '../anatomi/ExerciseFeed'

export const metadata: Metadata = { title: 'Kaydedilen hareketler · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const views = anatomyViews()
  if (!views) return <div className="px-4 flex flex-col gap-3"><TopBar back="/fitness" title="Kaydedilenler" /><p className="card p-5 text-[14px] text-mute">Şu an kullanılamıyor.</p></div>
  const [items, t] = await Promise.all([favoriteFeed(u.id), getToday(u.id)])
  return <ExerciseFeed title="Kaydedilenler" items={items} views={views} gender={t?.profile.sex === 'female' ? 'female' : 'male'} back="/fitness/anatomi" empty="Henüz kaydettiğin hareket yok. Akışta kalbe dokunarak kaydedebilirsin." />
}
