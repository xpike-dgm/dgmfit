import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { friendsOverview } from '@/lib/social-data'
import { TopBar, hdrBtn } from '@/components/ui'
import { RelButton } from '../SocialClient'

export const metadata: Metadata = { title: 'Arkadaşlar · DgFit' }

function Row({ username, children }: { username: string; children?: React.ReactNode }) {
  return <li className="flex items-center gap-2 min-h-12 border-b border-line last:border-0 flex-wrap"><Link href={`/u/${username}`} className="flex-1 font-bold truncate">{username}</Link>{children}</li>
}

export default async function Page() {
  const u = await requireUser()
  const o = await friendsOverview(u.id)
  const Sec = ({ title, n, children, testid }: { title: string; n: number; children: React.ReactNode; testid?: string }) => n ? <section className="card px-4 py-3" data-testid={testid}><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">{title} ({n})</span><ul>{children}</ul></section> : null
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Arkadaşlar" right={<Link href="/sosyal/ara" className={hdrBtn}>Ekle</Link>} />
      <Sec title="Gelen istekler" n={o.incoming.length} testid="incoming">{o.incoming.map((f) => <Row key={f.id} username={f.username}><RelButton op="accept" id={f.id} label="Kabul et" tone="primary" /><RelButton op="remove" id={f.id} label="Reddet" /></Row>)}</Sec>
      <Sec title="Arkadaşlar" n={o.friends.length} testid="friends">{o.friends.map((f) => <Row key={f.id} username={f.username}><RelButton op={f.close ? 'unclose' : 'close'} id={f.id} label={f.close ? '★ Yakın arkadaş' : '☆ Yakın yap'} /><RelButton op="remove" id={f.id} label="Çıkar" confirmText="Arkadaşlıktan çıkarılsın mı?" /></Row>)}</Sec>
      <Sec title="Gönderilen istekler" n={o.outgoing.length}>{o.outgoing.map((f) => <Row key={f.id} username={f.username}><RelButton op="remove" id={f.id} label="Geri çek" /></Row>)}</Sec>
      <Sec title="Takip ettiklerin" n={o.following.length}>{o.following.map((f) => <Row key={f.id} username={f.username}><RelButton op="unfollow" id={f.id} label="Takibi bırak" /></Row>)}</Sec>
      <Sec title="Takipçiler" n={o.followers.length}>{o.followers.map((f) => <Row key={f.id} username={f.username} />)}</Sec>
      <Sec title="Sessize alınanlar" n={o.muted.length}>{o.muted.map((f) => <Row key={f.id} username={f.username}><RelButton op="unmute" id={f.id} label="Sesi aç" /></Row>)}</Sec>
      <Sec title="Engellenenler" n={o.blocked.length} testid="blocked">{o.blocked.map((f) => <Row key={f.id} username={f.username}><RelButton op="unblock" id={f.id} label="Engeli kaldır" /></Row>)}</Sec>
      {!o.friends.length && !o.incoming.length ? <p className="card p-5 text-[14px] text-mute">Henüz arkadaşın yok. <Link href="/sosyal/ara" className="hit text-acc font-bold">Kişi ara</Link> ya da <Link href="/sosyal/ayarlar" className="hit text-acc font-bold">davet linkini</Link> paylaş.</p> : null}
    </div>
  )
}
