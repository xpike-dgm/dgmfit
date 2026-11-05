import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { userDetail } from '@/lib/admin-data'
import { aiSettings } from '@/lib/ai/engine'
import { FEEDBACK_KINDS, FEEDBACK_STATUS, type FeedbackKind, type FeedbackStatus } from '@/lib/access'
import { GOALS, fmtNum, type GoalType } from '@/lib/calc'
import { TopBar } from '@/components/ui'
import { Avatar, PreviewRow, StatusPill, ago } from '../../ui'
import Manage from './Manage'

export const metadata: Metadata = { title: 'Kullanıcı · Yönetim' }
export const dynamic = 'force-dynamic'
const dt = (d: Date | null) => (d ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) : '—')

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin()
  const { id } = await props.params
  const [d, settings] = await Promise.all([userDetail(id), aiSettings()])
  if (!d) notFound()
  const { user: u, stats: s, profile: p, goal: g } = d
  const info: [string, string][] = [
    ['Kayıt', dt(u.createdAt)],
    ['Son görülme', ago(u.lastSeenAt)],
    ['Durum değişimi', u.statusAt ? `${dt(u.statusAt)}${u.statusBy ? ` · ${u.statusBy}` : ''}` : '—'],
    ['Davet kodu', u.inviteCode ?? '—'],
    ['Kurulum', p?.onboardedAt ? dt(p.onboardedAt) : 'yapılmadı'],
    ['Hedef', g ? `${GOALS[g.type as GoalType]?.label ?? g.type} · ${fmtNum(g.dailyKcal)} kcal · ${fmtNum(g.startWeightKg, 1)} → ${fmtNum(g.targetWeightKg, 1)} kg` : '—'],
  ]
  const tiles: [string, number, string][] = [
    ['Antrenman', s.workouts, `${s.workouts30} son 30 gün`],
    ['Öğün kaydı', s.meals, `${s.meals30} son 30 gün`],
    ['Su kaydı', s.water, `${s.water30} son 30 gün`],
    ['Tartı', s.weights, 'kayıt'],
    ['AI bugün', s.ai_today, `${s.ai30} son 30 gün`],
    ['Gönderi', s.posts, `${s.friends} arkadaş`],
  ]
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-user" data-status={u.status}>
      <TopBar back="/yonetim/kullanicilar" title={`@${u.username}`} sub={u.email} />
      <section className="card p-4 flex items-center gap-3">
        <Avatar name={u.username} size={52} />
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <span className="flex items-center gap-1.5 flex-wrap"><b className="text-[17px] truncate">@{u.username}</b><StatusPill status={u.status} />{d.admin ? <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-acc text-acc-ink">YÖNETİCİ</span> : null}</span>
          <span className="text-[12.5px] text-mute truncate">{u.email}</span>
        </div>
      </section>
      <section className="grid grid-cols-3 gap-2" aria-label="Kullanım">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="card px-3 py-2.5 flex flex-col min-w-0">
            <span className="text-[11.5px] text-mute font-semibold truncate">{k}</span>
            <b className="num text-[20px] leading-tight">{fmtNum(v)}</b>
            <span className="text-[11px] text-mute truncate">{sub}</span>
          </div>
        ))}
      </section>
      <section className="card px-4 py-1"><dl className="divide-y divide-line">
        {info.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2.5 text-[13.5px]"><dt className="text-mute shrink-0">{k}</dt><dd className="font-semibold text-right break-words min-w-0">{v}</dd></div>)}
      </dl></section>
      <Manage u={{ id: u.id, username: u.username, status: u.status, aiDaily: u.aiDaily, note: u.adminNote ?? '', admin: d.admin, self: u.id === me.id }}
        stats={{ sessions: s.sessions, push: s.push, media: s.media, aiToday: s.ai_today }} defaultDaily={settings.userDaily} />
      {d.feedback.length ? (
        <section className="card p-4 flex flex-col gap-2">
          <h2 className="text-[13px] font-bold tracking-[0.06em] uppercase text-mute">Geri bildirimleri ({s.feedback})</h2>
          {d.feedback.map((f) => (
            <Link key={f.id} href={`/yonetim/geri-bildirim/${f.id}`} className="block">
              <PreviewRow left={<><b>{FEEDBACK_KINDS[f.kind as FeedbackKind]?.label}</b> · {f.body}</>} right={`${FEEDBACK_STATUS[f.status as FeedbackStatus]} · ${ago(f.createdAt)}`} />
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  )
}
