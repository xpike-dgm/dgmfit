import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { designerProfile } from '@/lib/cards/community-data'
import StudioHeader from '@/components/cards/StudioHeader'
import MiniPreview from '@/components/cards/MiniPreview'
import CommunityButton from '../../CommunityButton'

export const metadata = { title: 'Tasarımcı' }

/** Ö3c: tasarımcı profili — paylaştığı şablonlar, toplam kullanım/beğeni, yarışma rozetleri, takip. */
export default async function Page(props: { params: Promise<{ username: string }> }) {
  const u = await requireUser()
  const d = await designerProfile(u.id, decodeURIComponent((await props.params).username))
  if (!d) notFound()
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="designer">
      <StudioHeader back="/profil/ozellestirme/sablonlar" title={`@${d.username}`} />
      <p className="text-[12.5px] text-mute -mt-2 px-1">Tasarımcı</p>
      <section className="card p-4 flex items-center gap-3">
        <span aria-hidden className="w-14 h-14 rounded-full bg-acc text-acc-ink flex items-center justify-center text-[22px] font-extrabold">{d.username.slice(0, 1).toLocaleUpperCase('tr-TR')}</span>
        <span className="flex-1 flex flex-col">
          <b className="text-[17px]">@{d.username}</b>
          <span className="text-[12.5px] text-mute num" data-testid="designer-stats">{d.totals.templates} şablon · {d.totals.uses} kullanım · {d.totals.likes} beğeni · {d.followers} takipçi</span>
          {d.badges.length ? <span className="text-[12.5px] font-bold text-acc" data-testid="designer-badges">{d.badges.map((b) => `🏆 ${b.theme}`).join(' · ')}</span> : null}
        </span>
        {!d.me ? <CommunityButton input={{ op: 'follow', userId: d.id, on: !d.following }} label={d.following ? 'Takiptesin' : 'Takip et'} done={d.following ? 'Takip bırakıldı' : 'Takip ediyorsun'} testId="designer-follow"
          className={d.following ? 'h-10 px-4 rounded-full border border-line-2 text-[13px] font-bold' : undefined} /> : null}
      </section>
      <Link href={`/u/${d.username}`} className="text-[12.5px] text-mute underline px-1">Sosyal profili</Link>
      <div className="grid grid-cols-2 gap-2.5">
        {d.templates.map((t) => (
          <Link key={t.id} href={`/profil/ozellestirme/sablonlar/${t.id}`} className="card p-2.5 flex flex-col gap-2">
            <div className="flex justify-center"><MiniPreview design={t.data} width={100} label={`${t.name} önizlemesi`} /></div>
            <b className="text-[13.5px] truncate">{t.name}</b><span className="text-[11.5px] text-mute num">♥ {t.likes} · {t.uses} kullanım</span>
          </Link>
        ))}
      </div>
      {!d.templates.length ? <p className="card p-4 text-[14px] text-mute">Henüz paylaşılmış şablon yok.</p> : null}
    </div>
  )
}
