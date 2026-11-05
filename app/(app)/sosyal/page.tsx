import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { feed, friendIds, suggestions, unreadCount } from '@/lib/social-data'
import { myChallenges, storyStrip, unreadDMs } from '@/lib/social2-data'
import { Band, hdrBtn, hdrIcon } from '@/components/ui'
import { Bell, Next } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import Stories from './Stories'
import { mediaEnabled } from '@/lib/media'
import PostCard, { Avatar } from '@/components/social/PostCard'
import { SuggestButton } from './SocialClient'

export const metadata: Metadata = { title: 'Sosyal' }
const TABS = [['onerilen', 'Önerilen'], ['kronolojik', 'Kronolojik'], ['kaydedilen', 'Kaydedilenler']] as const

export default async function Page(props: { searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser()
  const { g } = await props.searchParams
  const tab = g === 'kronolojik' || g === 'kaydedilen' ? g : 'onerilen'
  const [posts, unread, sugg, stories, dms, fr, chs] = await Promise.all([feed(u.id, tab === 'kaydedilen' ? 'kronolojik' : tab, tab === 'kaydedilen'), unreadCount(u.id), suggestions(u.id), storyStrip(u.id), unreadDMs(u.id), friendIds(u.id), myChallenges(u.id)])
  const friends = fr.length
  const activeCh = chs.filter((c) => c.status === 'joined' && !c.ended).length
  return (
    <div className="px-4 flex flex-col gap-3">
      <Band title="Sosyal" sub="Arkadaşlarınla motive kal"
        right={
          <div className="flex gap-2">
            <Link href="/sosyal/ara" className={hdrBtn}>Ara</Link>
            <Link href="/sosyal/bildirimler" aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} className={hdrIcon + ' relative'} data-testid="notif-bell">
              <Bell size={19} />{unread ? <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-white text-[11px] font-bold text-[var(--m1)] flex items-center justify-center num">{unread}</span> : null}
            </Link>
          </div>
        }
        ring={{ value: friends ? 1 : 0, big: fmtNum(friends), small: 'arkadaş', label: `${friends} arkadaş` }}
        pills={[['Meydan okuma', `${activeCh} aktif`], ['Mesaj', dms ? `${dms} yeni` : 'yok'], ['Bildirim', unread ? `${unread} yeni` : 'yok']]} />
      <nav className="card px-4 py-1 flex flex-col" aria-label="Sosyal bölümler">
        <Link href="/sosyal/mesaj" className="flex items-center justify-between min-h-12 text-[14px] font-semibold" data-testid="dm-link">Mesajlar<span className="flex items-center gap-1.5 text-mute">{dms ? <span className="min-w-5 h-5 px-1 rounded-full bg-acc text-[11px] text-acc-ink num inline-flex items-center justify-center">{dms}</span> : null}<Next size={16} /></span></Link>
        <Link href="/sosyal/meydan" className="flex items-center justify-between min-h-12 text-[14px] font-semibold border-t border-line">Meydan okumalar<Next size={16} className="text-mute" /></Link>
        <Link href="/sosyal/gruplar" className="flex items-center justify-between min-h-12 text-[14px] font-semibold border-t border-line">Gruplar<Next size={16} className="text-mute" /></Link>
        <Link href="/sosyal/arkadaslar" className="flex items-center justify-between min-h-12 text-[14px] font-semibold border-t border-line">Arkadaşlar<Next size={16} className="text-mute" /></Link>
      </nav>
      <Stories stories={stories} mediaOn={mediaEnabled()} />
      <div className="flex gap-2">
        <Link href="/sosyal/yeni" className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold inline-flex items-center justify-center">Paylaş</Link>
        <Link href={`/u/${u.username}`} className="h-12 px-4 rounded-full border border-line-2 font-bold inline-flex items-center">Profilim</Link>
      </div>
      <nav className="flex gap-1.5" aria-label="Akış görünümü">{TABS.map(([k, l]) => <Link key={k} href={k === 'onerilen' ? '/sosyal' : `/sosyal?g=${k}`} aria-current={tab === k ? 'page' : undefined} className="h-9 px-3 rounded-full text-[13px] font-bold bg-surface-2 aria-[current=page]:bg-acc aria-[current=page]:text-acc-ink inline-flex items-center">{l}</Link>)}</nav>
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
