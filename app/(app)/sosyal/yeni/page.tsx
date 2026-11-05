import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { shareSources } from '@/lib/social-data'
import { listProgressPhotos, mediaEnabled } from '@/lib/media'
import { dayString } from '@/lib/time'
import { TopBar } from '@/components/ui'
import Composer from './Composer'

export const metadata: Metadata = { title: 'Paylaş · DgFit' }
const KINDS = ['text', 'workout', 'pr', 'recipe', 'meal', 'streak', 'milestone', 'progress']

export default async function Page(props: { searchParams: Promise<{ tur?: string; ref?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const [src, photos] = await Promise.all([shareSources(u.id), listProgressPhotos(u.id)])
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Paylaş" />
      <Composer initialKind={KINDS.includes(sp.tur ?? '') ? sp.tur! : 'text'} initialRef={sp.ref?.slice(0, 80) ?? null} today={dayString()} mediaOn={mediaEnabled()}
        workouts={src.workouts.map((w) => ({ id: w.id, label: `${w.name} · ${w.day}` }))} prs={src.prs.map((p) => ({ id: String(p.id), label: `${p.name} · ${p.label} ${p.value}` }))}
        recipes={src.recipes.map((r) => ({ id: String(r.id), label: r.name ?? 'Tarif' }))} friends={src.friends.map((f) => ({ id: f.id, username: f.username }))}
        progress={photos.slice(0, 12).map((p) => ({ id: p.id, label: `${p.day}${p.pose ? ' · ' + p.pose : ''}` }))} />
    </div>
  )
}
