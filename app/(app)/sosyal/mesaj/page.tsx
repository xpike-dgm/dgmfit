import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { threads } from '@/lib/social2-data'
import { friendsOverview } from '@/lib/social-data'
import { TopBar } from '@/components/ui'
import { SharePost } from './[username]/Thread'

export const metadata: Metadata = { title: 'Mesajlar · DgFit' }

export default async function Page(props: { searchParams: Promise<{ paylas?: string }> }) {
  const u = await requireUser()
  const { paylas } = await props.searchParams
  const [ts, fr] = await Promise.all([threads(u.id), friendsOverview(u.id)])
  const postId = paylas && /^[0-9a-f-]{36}$/.test(paylas) ? paylas : null
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Mesajlar" />
      {postId ? <SharePost postId={postId} friends={fr.friends.map((f) => f.username)} /> : null}
      <section className="card p-4 flex flex-col" data-testid="threads">
        {ts.length ? ts.map((t) => (
          <Link key={t.username} href={`/sosyal/mesaj/${encodeURIComponent(t.username)}`} className="flex items-center gap-2 min-h-14 border-b border-line last:border-0" data-testid="thread-row">
            <span className="flex-1 min-w-0"><b className="block truncate">{t.username}</b><span className="text-[13px] text-mute truncate block">{t.last || 'Paylaşılan gönderi'}</span></span>
            {t.unread ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-orange text-[11px] text-bg font-bold num flex items-center justify-center">{t.unread}</span> : null}
          </Link>
        )) : <p className="text-[14px] text-mute">Mesaj yok. Arkadaşının profilinden "Mesaj" ile başla.</p>}
      </section>
      {fr.friends.length ? <section className="card p-4 flex flex-wrap gap-1.5"><span className="w-full text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Yeni mesaj</span>{fr.friends.map((f) => <Link key={f.id} href={`/sosyal/mesaj/${encodeURIComponent(f.username)}`} className="h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold inline-flex items-center">{f.username}</Link>)}</section> : null}
    </div>
  )
}
