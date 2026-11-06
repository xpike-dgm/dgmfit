import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { profileView } from '@/lib/social-data'
import { fmtNum } from '@/lib/calc'
import { TopBar, hdrBtn } from '@/components/ui'
import PostCard, { Avatar } from '@/components/social/PostCard'
import { RelButton } from '../../sosyal/SocialClient'
import { partnerStatus, pendingPRs } from '@/lib/social2-data'
import { FriendTools, PendingPRs } from './ProfileExtras'

export const metadata: Metadata = { title: 'Profil · DgFit' }
const VIS: Record<string, string> = { public: 'Herkese açık profil', friends: 'Yalnızca arkadaşlar', private: 'Gizli profil' }

function Spark({ pts }: { pts: { kg: number }[] }) {
  if (pts.length < 2) return null
  const lo = Math.min(...pts.map((p) => p.kg)), hi = Math.max(...pts.map((p) => p.kg)), W = 80, H = 24
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * W},${H - (hi === lo ? H / 2 : ((p.kg - lo) / (hi - lo)) * H)}`).join(' ')
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0"><polyline points={d} fill="none" stroke="var(--color-acc)" strokeWidth="2" strokeLinecap="round" /></svg>
}

export default async function Page(props: { params: Promise<{ username: string }>; searchParams: Promise<{ davet?: string }> }) {
  const me = await requireUser()
  const { username } = await props.params
  const { davet } = await props.searchParams
  const v = await profileView(me.id, decodeURIComponent(username))
  if (!v || (v.hidden && !v.iBlocked)) notFound() // engelleyen dışında varlığı sızdırılmaz
  if (v.hidden) return (
    <div className="px-4 flex flex-col gap-3"><TopBar back="/sosyal" title={v.username} />
      <p className="card p-5 text-[14px] text-mute">Bu kişiyi engelledin.</p>
      <RelButton op="unblock" id={v.id} label="Engeli kaldır" />
    </div>
  )
  const self = v.rel === 'self'
  const [partner, pend] = await Promise.all([v.rel === 'friend' ? partnerStatus(me.id, v.id) : null, self || (v.rel === 'friend' && v.showcase) ? pendingPRs(v.id) : []])
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="profile">
      <TopBar back="/sosyal" title={v.username} right={self ? <div className="flex gap-2"><Link href="/sosyal?g=kaydedilen" className={hdrBtn} data-testid="saved-posts">Kaydedilenler</Link><Link href="/sosyal/ayarlar" className={hdrBtn}>Düzenle</Link></div> : undefined} />
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <Avatar src={v.avatar} name={v.username} size={72} />
          <div className="flex flex-col gap-1 min-w-0">
            <b className="text-[20px] truncate">{v.username}</b>
            {v.badge ? <span className="self-start text-[12px] font-bold px-2.5 py-1 rounded-full bg-acc text-acc-ink" data-testid="goal-badge">{v.badge}</span> : null}
            <span className="text-[12px] text-mute">{v.friends} arkadaş · {VIS[v.visibility]}</span>
          </div>
        </div>
        {v.bio ? <p className="text-[14px] whitespace-pre-wrap">{v.bio}</p> : null}
        {v.gym ? <p className="text-[13px] text-ink-2">🏋️ {v.gym}</p> : null}
        {!self ? (
          <div className="flex flex-wrap gap-2 items-center" data-testid="profile-actions">
            {v.status === 'accepted' ? <RelButton op="remove" id={v.id} label="Arkadaşlıktan çıkar" confirmText="Arkadaşlıktan çıkarılsın mı?" />
              : v.status === 'pending_in' ? <><RelButton op="accept" id={v.id} label="İsteği kabul et" tone="primary" /><RelButton op="remove" id={v.id} label="Reddet" /></>
              : v.status === 'pending_out' ? <RelButton op="remove" id={v.id} label="İsteği geri çek" />
              : v.access.canRequest ? <RelButton op="request" username={v.username} label={davet ? 'Daveti kabul et: arkadaş ekle' : 'Arkadaş ekle'} tone="primary" /> : null}
            {v.rel === 'follower' ? <RelButton op="unfollow" id={v.id} label="Takibi bırak" /> : v.access.canFollow && v.status !== 'accepted' ? <RelButton op="follow" id={v.id} label="Takip et" /> : null}
            <RelButton op="mute" id={v.id} label="Sessize al" />
            <RelButton op="block" id={v.id} label="Engelle" tone="danger" confirmText="Engellenen kişi profilini ve gönderilerini göremez; arkadaşlık kaldırılır. Devam edilsin mi?" />
          </div>
        ) : null}
      </section>

      {partner ? <FriendTools userId={v.id} username={v.username} partner={partner} /> : null}
      <PendingPRs prs={pend} self={self} canWitness={v.rel === 'friend'} />
      {v.showcase ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="PR vitrini" data-testid="showcase">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">PR vitrini</span>
          {v.showcase.length ? v.showcase.map((s) => (
            <div key={s.exerciseId} className="flex items-center gap-3 py-1 border-b border-line last:border-0">
              <span className="flex-1 font-semibold">{s.name}</span><Spark pts={s.history} />
              <span className="num font-bold">{fmtNum(s.kg, s.kg % 1 ? 1 : 0)} kg</span><span className="num text-[12px] text-mute w-20 text-right">e1RM {fmtNum(s.e1rm)}</span>
            </div>
          )) : <p className="text-[13px] text-mute">{self ? 'Ayarlardan vitrine hareket seç.' : 'Vitrin boş.'}</p>}
        </section>
      ) : null}
      {v.stats ? (
        <section className="grid grid-cols-2 gap-2" aria-label="İstatistikler" data-testid="stat-cards">
          {[['Antrenman', fmtNum(v.stats.workouts)], ['Toplam kaldırılan', `${fmtNum(Math.round(v.stats.volumeKg / 1000))} t`], ['En uzun seri', `${v.stats.weekStreak} hafta`], ['Su serisi', `${v.stats.waterStreak} gün`], ['Su rozeti', String(v.stats.badges)]].map(([l, x]) => (
            <div key={l} className="card px-4 py-3 flex flex-col"><span className="text-[12px] text-mute">{l}</span><span className="num text-[22px] font-bold">{x}</span></div>
          ))}
        </section>
      ) : null}
      {self ? <p className="text-[12px] text-mute px-1">Kilo ve vücut verilerin profilde asla görünmez; yalnızca isteğe bağlı kilometre taşı gönderisiyle değişim olarak paylaşılır.</p> : null}

      {v.access.detail ? (v.posts.length ? v.posts.map((p) => <PostCard key={p.id} p={p} />) : <p className="card p-5 text-[14px] text-mute">Görebileceğin gönderi yok.</p>)
        : <p className="card p-5 text-[14px] text-mute">Bu profilin ayrıntılarını yalnızca arkadaşları görür.</p>}
    </div>
  )
}
