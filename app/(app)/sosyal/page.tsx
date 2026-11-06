import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { feed, friendIds, suggestions, unreadCount } from '@/lib/social-data'
import { myChallenges, myGroups, storyStrip, unreadDMs } from '@/lib/social2-data'
import { Band, btn, hdrIcon } from '@/components/ui'
import { Bell, Search, User } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import Stories from './Stories'
import { mediaEnabled } from '@/lib/media'
import PostCard, { Avatar } from '@/components/social/PostCard'
import { SuggestButton } from './SocialClient'

export const metadata: Metadata = { title: 'Sosyal' }
const TABS = [['onerilen', 'Önerilen'], ['kronolojik', 'Kronolojik']] as const

export default async function Page(props: { searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser()
  const { g } = await props.searchParams
  const tab = g === 'kronolojik' || g === 'kaydedilen' ? g : 'onerilen'
  const [posts, unread, sugg, stories, dms, fr, chs, grs] = await Promise.all([feed(u.id, tab === 'kaydedilen' ? 'kronolojik' : tab, tab === 'kaydedilen'), unreadCount(u.id), suggestions(u.id), storyStrip(u.id), unreadDMs(u.id), friendIds(u.id), myChallenges(u.id), myGroups(u.id)])
  const friends = fr.length
  const activeCh = chs.filter((c) => c.status === 'joined' && !c.ended).length
  const groups = grs.filter((g) => g.status === 'joined').length
  return (
    <div className="px-4 flex flex-col gap-3">
      <Band title="Sosyal" sub="Arkadaşlarınla motive kal"
        right={
          <div className="flex gap-2">
            <Link href="/sosyal/ara" aria-label="Ara" className={hdrIcon}><Search size={19} /></Link>
            <Link href={`/u/${u.username}`} aria-label="Profilim" className={hdrIcon} data-testid="my-profile"><User size={19} /></Link>
            <Link href="/sosyal/bildirimler" aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} className={hdrIcon + ' relative'} data-testid="notif-bell">
              <Bell size={19} />{unread ? <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-white text-[11px] font-bold text-[var(--m1)] flex items-center justify-center num">{unread}</span> : null}
            </Link>
          </div>
        }
        ring={{ value: friends ? 1 : 0, big: fmtNum(friends), small: 'arkadaş', label: `${friends} arkadaş, arkadaşlarını aç` }} ringHref="/sosyal/arkadaslar"
        pills={[['Meydan okuma', `${activeCh} aktif`, '/sosyal/meydan', 'meydan-link'], ['Mesajlar', dms ? `${dms} yeni` : 'yok', '/sosyal/mesaj', 'dm-link'], ['Gruplar', groups ? `${groups}` : 'yok', '/sosyal/gruplar', 'groups-link']]} />
      {friends === 0 ? (
        <section className="card p-4 flex flex-col gap-3" aria-label="Arkadaş bul" data-testid="no-friends">
          <div className="flex flex-col gap-0.5"><b className="text-[16px]">Arkadaşlarını ekle</b><span className="text-[13px] text-mute">Antrenman ve rekorlarını birlikte takip edin.</span></div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/sosyal/ara" className={btn.secondary}>Ara</Link>
            <Link href="/sosyal/ayarlar/davet" className={btn.secondary}>Davet et</Link>
          </div>
        </section>
      ) : null}
      <Stories stories={stories} mediaOn={mediaEnabled()} />
      {tab === 'kaydedilen' ? <div className="flex items-center justify-between"><b className="text-[16px]">Kaydedilenler</b><Link href="/sosyal" className="text-[13px] text-mute">Akışa dön</Link></div> : null}
      <nav className="flex gap-1.5" aria-label="Akış görünümü" hidden={tab === 'kaydedilen'}>{TABS.map(([k, l]) => <Link key={k} href={k === 'onerilen' ? '/sosyal' : `/sosyal?g=${k}`} aria-current={tab === k ? 'page' : undefined} className="h-9 px-3 rounded-full text-[13px] font-bold bg-surface-2 aria-[current=page]:bg-acc aria-[current=page]:text-acc-ink inline-flex items-center">{l}</Link>)}</nav>
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
        <p className="card p-5 text-[14px] text-mute">{tab === 'kaydedilen' ? 'Kaydettiğin gönderi yok.' : friends === 0 ? 'Henüz gönderi yok.' : 'Akış boş. İlk gönderini paylaş: antrenman özeti, rekor, tarif ya da su serin.'}</p>
      )}
      <p className="text-[11px] text-faint text-center">Varsayılan olarak her şey özeldir; neyi kiminle paylaşacağını <Link href="/sosyal/ayarlar" className="underline">gizlilik ayarlarından</Link> seçersin.</p>
    </div>
  )
}
