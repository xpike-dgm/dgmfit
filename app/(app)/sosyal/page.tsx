import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { feed, suggestions, unreadCount } from '@/lib/social-data'
import PostCard, { Avatar } from '@/components/social/PostCard'
import { SuggestButton } from './SocialClient'

export const metadata: Metadata = { title: 'Sosyal' }
const TABS = [['onerilen', 'Önerilen'], ['kronolojik', 'Kronolojik'], ['kaydedilen', 'Kaydedilenler']] as const

export default async function Page(props: { searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser()
  const { g } = await props.searchParams
  const tab = g === 'kronolojik' || g === 'kaydedilen' ? g : 'onerilen'
  const [posts, unread, sugg] = await Promise.all([feed(u.id, tab === 'kaydedilen' ? 'kronolojik' : tab, tab === 'kaydedilen'), unreadCount(u.id), suggestions(u.id)])
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <h1 className="text-[26px] font-extrabold tracking-tight flex-1">Sosyal</h1>
        <Link href="/sosyal/ara" className="h-10 px-3 rounded-full bg-surface-2 text-[13px] font-bold inline-flex items-center">Ara</Link>
        <Link href="/sosyal/arkadaslar" className="h-10 px-3 rounded-full bg-surface-2 text-[13px] font-bold inline-flex items-center">Arkadaşlar</Link>
        <Link href="/sosyal/bildirimler" aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} className="relative h-10 w-10 rounded-full bg-surface-2 inline-flex items-center justify-center" data-testid="notif-bell">
          🔔{unread ? <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-orange text-[11px] font-bold text-bg flex items-center justify-center num">{unread}</span> : null}
        </Link>
      </header>
      <div className="flex gap-2">
        <Link href="/sosyal/yeni" className="flex-1 h-12 rounded-full bg-lime text-lime-ink font-extrabold inline-flex items-center justify-center">Paylaş</Link>
        <Link href={`/u/${u.username}`} className="h-12 px-4 rounded-full border border-line-2 font-bold inline-flex items-center">Profilim</Link>
      </div>
      <nav className="flex gap-1.5" aria-label="Akış görünümü">{TABS.map(([k, l]) => <Link key={k} href={k === 'onerilen' ? '/sosyal' : `/sosyal?g=${k}`} aria-current={tab === k ? 'page' : undefined} className="h-9 px-3 rounded-full text-[13px] font-bold bg-surface-2 aria-[current=page]:bg-ink aria-[current=page]:text-bg inline-flex items-center">{l}</Link>)}</nav>
      {sugg.length && tab !== 'kaydedilen' ? (
        <section className="card p-4 flex flex-col gap-2" aria-label="Arkadaş önerileri">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Tanıyor olabilirsin</span>
          <ul className="flex flex-col gap-2">{sugg.slice(0, 4).map((s) => (
            <li key={s.id} className="flex items-center gap-3"><Avatar src={null} name={s.username} size={34} />
              <Link href={`/u/${s.username}`} className="flex-1 min-w-0"><b className="truncate block">{s.username}</b><span className="text-[12px] text-mute">{[s.mutual ? `${s.mutual} ortak arkadaş` : '', s.sameGym ? 'aynı salon' : ''].filter(Boolean).join(' · ') || 'benzer hedef'}</span></Link>
              <SuggestButton username={s.username} /></li>
          ))}</ul>
        </section>
      ) : null}
      {posts.length ? posts.map((p) => <PostCard key={p.id} p={p} />) : (
        <p className="card p-5 text-[14px] text-mute">{tab === 'kaydedilen' ? 'Kaydettiğin gönderi yok.' : 'Akış boş. Arkadaş ekle ya da ilk gönderini paylaş: antrenman özeti, rekor, tarif ya da su serin.'}</p>
      )}
      <p className="text-[11px] text-faint text-center">Varsayılan olarak her şey özeldir; neyi kiminle paylaşacağını <Link href="/sosyal/ayarlar" className="underline">gizlilik ayarlarından</Link> seçersin.</p>
    </div>
  )
}
