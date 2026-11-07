import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { contestPage } from '@/lib/cards/community-data'
import { TopBar } from '@/components/ui'
import MiniPreview from '@/components/cards/MiniPreview'
import CommunityButton from '../CommunityButton'
import EnterForm from './EnterForm'

export const metadata = { title: 'Tasarım yarışması' }

/** Ö3c: haftalık tasarım yarışması — tema, katıl, oy ver; geçmiş haftaların kazananları (tasarımcı rozeti). */
export default async function Page() {
  const u = await requireUser()
  const c = await contestPage(u.id)
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="contest">
      <TopBar back="/profil/ozellestirme" title="Tasarım yarışması" sub="Haftalık tema, topluluk oyu" />
      {c.current ? (
        <section className="card p-4 flex flex-col gap-2" data-testid="contest-current">
          <span className="text-[12px] font-bold text-mute tracking-[0.06em] uppercase">Bu haftanın teması</span>
          <h2 className="text-[20px] font-extrabold">{c.current.theme}</h2>
          {c.current.description ? <p className="text-[14px] text-ink-2">{c.current.description}</p> : null}
          <p className="text-[12.5px] text-mute">Kendi şablonunla katıl; her kişinin tek oyu var, kendi tasarımına oy verilemez. Hafta bitince en çok oyu alan kazanır ve tasarımcı rozeti alır.</p>
          {c.current.open ? <EnterForm mine={c.mine} current={c.myEntry} /> : null}
        </section>
      ) : <p className="card p-4 text-[14px] text-mute" data-testid="contest-none">Bu hafta yarışma yok. Yönetim yeni temayı açınca burada görünür.</p>}
      {c.entries.length ? (
        <section aria-label="Katılımcılar" className="grid grid-cols-2 gap-2.5" data-testid="contest-entries">
          {c.entries.map((e, i) => (
            <div key={e.templateId} className="card p-2.5 flex flex-col gap-2" data-entry={e.name}>
              <Link href={`/profil/ozellestirme/sablonlar/${e.templateId}`} className="flex justify-center"><MiniPreview design={e.data} width={100} label={`${e.name} önizlemesi`} /></Link>
              <b className="text-[13.5px] truncate">{i === 0 && e.votes ? '🥇 ' : ''}{e.name}</b>
              <span className="text-[11.5px] text-mute">@{e.owner} · <span className="num" data-testid="entry-votes">{e.votes}</span> oy</span>
              {c.current?.open && e.userId !== u.id ? (c.myVote === e.templateId ? <span className="text-[12.5px] font-bold text-acc">✓ Oyun burada</span>
                : <CommunityButton input={{ op: 'vote', templateId: e.templateId }} label="Oy ver" done="Oyun kaydedildi" testId="contest-vote" />) : null}
            </div>
          ))}
        </section>
      ) : null}
      {c.past.length ? (
        <section aria-label="Geçmiş yarışmalar" className="card px-4 py-1 flex flex-col">
          <h2 className="text-[15px] font-extrabold pt-3 pb-1">Geçmiş haftalar</h2>
          {c.past.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 min-h-[52px] border-t border-line first:border-0">
              <span className="flex flex-col"><b className="text-[14px]">{p.theme}</b><span className="text-[12px] text-mute">{p.week} haftası</span></span>
              {p.winner ? <Link href={`/profil/ozellestirme/tasarimci/${p.winner.owner}`} className="text-[12.5px] font-bold text-acc">🏆 @{p.winner.owner}</Link> : <span className="text-[12px] text-mute">kazanan yok</span>}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
