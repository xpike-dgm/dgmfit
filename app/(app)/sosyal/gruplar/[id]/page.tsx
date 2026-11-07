import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { groupView } from '@/lib/social2-data'
import { friendsOverview } from '@/lib/social-data'
import { METRICS, TEMPLATES } from '@/lib/social-rank'
import { fmtNum } from '@/lib/calc'
import { TopBar } from '@/components/ui'
import { GroupChat, GroupOp } from '../GroupClient'
import NewChallenge from '../../meydan/NewChallenge'
import { groupTheme } from '@/lib/cards/community-data'
import MiniPreview from '@/components/cards/MiniPreview'

export const metadata: Metadata = { title: 'Grup · DgFit' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  const g = /^[0-9a-f-]{36}$/.test(id) ? await groupView(u.id, id) : null
  if (!g) notFound()
  if (g.invited) return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal/gruplar" title={g.name} />
      <section className="card p-5 flex flex-col gap-3"><b>{g.name}</b>{g.description ? <p className="text-[14px] text-ink-2">{g.description}</p> : null}<p className="text-[13px] text-mute">Bu gruba davet edildin.</p>
        <div className="flex gap-2"><GroupOp op="accept" groupId={g.id} label="Katıl" tone="primary" /><GroupOp op="decline" groupId={g.id} label="Reddet" after="/sosyal/gruplar" /></div></section>
    </div>
  )
  const fr = await friendsOverview(u.id)
  const memberIds = new Set(g.members.map((m) => m.id))
  const invitable = fr.friends.filter((f) => !memberIds.has(f.id))
  const theme = await groupTheme(g.id)
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="group">
      <TopBar back="/sosyal/gruplar" title={g.name} />
      {g.description ? <p className="text-[14px] text-ink-2 px-1">{g.description}</p> : null}
      {theme ? (
        <Link href={`/profil/ozellestirme/sablonlar/${theme.id}`} className="card p-3 flex items-center gap-3" data-testid="group-theme-card">
          <MiniPreview design={theme.data} width={56} label={`${theme.name} önizlemesi`} />
          <span className="flex flex-col min-w-0"><span className="text-[11px] font-extrabold text-mute tracking-[0.06em]">GRUP TEMASI</span><b className="truncate">{theme.name}</b><span className="text-[12.5px] text-acc font-bold">Önizle ve kullan ›</span></span>
        </Link>
      ) : null}
      <section className="card p-4 flex flex-col gap-2" aria-label="Sıralama" data-testid="group-boards">
        <div className="flex items-center justify-between"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Sıralama</span>
          {g.myOptIn ? <GroupOp op="optout" groupId={g.id} label="Sıralamadan çık" /> : <GroupOp op="optin" groupId={g.id} label="Sıralamada görün" tone="primary" />}</div>
        <p className="text-[12px] text-mute">Yalnızca katılmayı seçen üyeler. Kuvvet: squat + bench + deadlift tahmini 1RM toplamının DOTS puanı (vücut ağırlığına göre; ağırlık gösterilmez, şüpheli rekorlar sayılmaz). Tutarlılık: son 4 haftada haftalık antrenman hedefini tutturma.</p>
        <div className="grid grid-cols-2 gap-3">
          <div data-testid="dots-board"><b className="text-[13px]">Kuvvet (DOTS)</b>{g.dotsBoard.length ? g.dotsBoard.map((r) => <div key={r.userId} className="flex justify-between text-[13px] py-1 border-b border-line last:border-0"><span className="truncate">{r.rank}. {r.name}</span><span className="num">{fmtNum(r.value, 1)}</span></div>) : <p className="text-[12px] text-mute">Veri yok</p>}</div>
          <div data-testid="cons-board"><b className="text-[13px]">Tutarlılık</b>{g.consBoard.length ? g.consBoard.map((r) => <div key={r.userId} className="flex justify-between text-[13px] py-1 border-b border-line last:border-0"><span className="truncate">{r.rank}. {r.name}</span><span className="num">%{r.value}</span></div>) : <p className="text-[12px] text-mute">Veri yok</p>}</div>
        </div>
      </section>
      <GroupChat groupId={g.id} messages={g.messages} />
      {g.challenges.length ? <section className="card p-4 flex flex-col">{g.challenges.map((c) => <Link key={c.id} href={`/sosyal/meydan/${c.id}`} className="min-h-11 flex items-center justify-between border-b border-line last:border-0"><b>{c.title}</b><span className="text-[12px] text-mute">{c.endDay}</span></Link>)}</section> : null}
      <NewChallenge groupId={g.id} templates={TEMPLATES.map((t) => ({ key: t.key, title: t.title, days: t.days }))} metrics={Object.entries(METRICS).map(([k, v]) => ({ key: k, label: v.label, unit: v.unit }))} friends={[]} />
      <section className="card p-4 flex flex-col gap-1" aria-label="Üyeler" data-testid="group-members">
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Üyeler</span>
        {g.members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 min-h-11 border-b border-line last:border-0">
            <Link href={`/u/${m.username}`} className="flex-1 font-semibold truncate">{m.username}{m.owner ? ' ★' : ''}{m.status === 'invited' ? <span className="text-[12px] text-mute font-normal"> · davet edildi</span> : null}</Link>
            {g.owner && !m.owner ? <GroupOp op="remove" groupId={g.id} userId={m.id} label="Çıkar" tone="danger" confirmText="Üye gruptan çıkarılsın mı?" /> : null}
          </div>
        ))}
        {invitable.length ? <div className="flex flex-wrap gap-1.5 pt-2" role="group" aria-label="Arkadaş davet et">{invitable.map((f) => <GroupOp key={f.id} op="invite" groupId={g.id} userId={f.id} label={`+ ${f.username}`} />)}</div> : null}
      </section>
      <GroupOp op="leave" groupId={g.id} label={g.owner ? 'Grubu kapat' : 'Gruptan ayrıl'} tone="danger" confirmText={g.owner ? 'Grup herkes için kapanacak. Emin misin?' : 'Gruptan ayrılınsın mı?'} after="/sosyal/gruplar" />
    </div>
  )
}
