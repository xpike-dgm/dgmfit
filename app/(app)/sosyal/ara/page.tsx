import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { searchUsers, suggestions } from '@/lib/social-data'
import { TopBar } from '@/components/ui'
import { Avatar } from '@/components/social/PostCard'
import { RelButton, SuggestButton } from '../SocialClient'

export const metadata: Metadata = { title: 'Kişi ara · DgFit' }

export default async function Page(props: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser()
  const { q } = await props.searchParams
  const [res, sugg] = await Promise.all([q ? searchUsers(u.id, q.slice(0, 40)) : [], suggestions(u.id)])
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Kişi ara" />
      <form className="flex gap-2" action="/sosyal/ara">
        <label htmlFor="user-q" className="sr-only">Kullanıcı adı</label>
        <input id="user-q" name="q" defaultValue={q ?? ''} placeholder="Kullanıcı adı" autoCapitalize="none" className="flex-1 h-12 rounded-full bg-surface-2 border border-line px-4" />
        <button type="submit" className="h-12 px-5 rounded-full bg-lime text-lime-ink font-bold">Ara</button>
      </form>
      {q ? (
        <section className="card p-4 flex flex-col gap-2" data-testid="search-results">
          {res.length ? res.map((r) => (
            <div key={r.id} className="flex items-center gap-3" data-testid="search-row">
              <Avatar src={null} name={r.username} size={36} />
              <Link href={`/u/${r.username}`} className="flex-1 font-bold truncate">{r.username}</Link>
              {r.status === 'accepted' ? <span className="text-[12px] text-lime">Arkadaş</span> : r.status === 'pending_out' ? <span className="text-[12px] text-mute">İstek gönderildi</span>
                : r.status === 'pending_in' ? <RelButton op="accept" id={r.id} label="Kabul et" tone="primary" /> : <SuggestButton username={r.username} />}
            </div>
          )) : <p className="text-[14px] text-mute">Sonuç yok. Gizli profiller aramada görünmez.</p>}
        </section>
      ) : null}
      {sugg.length ? (
        <section className="card p-4 flex flex-col gap-2"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Öneriler</span>
          {sugg.map((s) => <div key={s.id} className="flex items-center gap-3"><Avatar src={null} name={s.username} size={36} /><Link href={`/u/${s.username}`} className="flex-1 font-bold truncate">{s.username}</Link><SuggestButton username={s.username} /></div>)}
        </section>
      ) : null}
    </div>
  )
}
