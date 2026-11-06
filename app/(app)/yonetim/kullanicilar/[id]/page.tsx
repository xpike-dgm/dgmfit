import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { userActivity, userDetail, type ActivityKind } from '@/lib/admin-data'
import { aiSettings } from '@/lib/ai/engine'
import { FEEDBACK_KINDS, FEEDBACK_STATUS, type FeedbackKind, type FeedbackStatus } from '@/lib/access'
import { GOALS, fmtNum, type GoalType } from '@/lib/calc'
import { TopBar } from '@/components/ui'
import { Avatar, PreviewRow, StatusPill, ago } from '../../ui'
import Manage from './Manage'

export const metadata: Metadata = { title: 'Kullanıcı · Yönetim' }
export const dynamic = 'force-dynamic'
const dt = (d: Date | null) => (d ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) : '—')

const TABS = [['ozet', 'Özet'], ['islemler', 'Son işlemler'], ['yonet', 'Yönet']] as const
type Tab = (typeof TABS)[number][0]
const KIND: Record<ActivityKind, string> = { login: '#7C8CF8', meal: '#F2994A', water: '#3BA7F0', workout: '#E85D3F', cardio: '#E85D3F', weight: '#9B8AFB', measure: '#9B8AFB', program: '#E85D3F', post: '#2FB67C', comment: '#2FB67C', message: '#2FB67C', ai: '#C77DFF', feedback: '#F5B83D', profile: '#8A8F98' }
const TZ = 'Europe/Istanbul'
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const dayLabel = (d: Date) => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
const hm = (d: Date) => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d)
/** Tarayıcı kimliğinden kısa cihaz adı (ör. "Android 14 · Chrome"). */
function device(ua: string): string {
  const os = /Android [\d.]+/.exec(ua)?.[0] ?? (/iPhone|iPad/.test(ua) ? (/OS (\d+)/.exec(ua)?.[1] ? `iOS ${/OS (\d+)/.exec(ua)![1]}` : 'iOS') : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '')
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return [os, br].filter(Boolean).join(' · ') || 'bilinmeyen cihaz'
}

export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ sekme?: string }> }) {
  const me = await requireAdmin()
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams])
  const tab: Tab = TABS.some(([k]) => k === sp.sekme) ? (sp.sekme as Tab) : 'ozet'
  const [d, settings, acts] = await Promise.all([userDetail(id), aiSettings(), tab === 'islemler' ? userActivity(id) : Promise.resolve([])])
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
  const groups: { key: string; label: string; items: typeof acts }[] = []
  for (const a of acts) {
    const k = dayKey(a.at)
    if (groups.at(-1)?.key !== k) groups.push({ key: k, label: dayLabel(a.at), items: [] })
    groups.at(-1)!.items.push(a)
  }
  return (
    <div className="px-4 flex flex-col gap-3 pb-6" data-testid="admin-user" data-status={u.status}>
      <TopBar back="/yonetim/kullanicilar" title={`@${u.username}`} sub={u.email} />
      <section className="card p-4 flex items-center gap-3">
        <Avatar name={u.username} size={52} />
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <span className="flex items-center gap-1.5 flex-wrap"><b className="text-[17px] truncate">@{u.username}</b><StatusPill status={u.status} />{d.admin ? <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-acc text-acc-ink">YÖNETİCİ</span> : null}</span>
          <span className="text-[12.5px] text-mute truncate">Son görülme {ago(u.lastSeenAt)} · kayıt {ago(u.createdAt)}</span>
        </div>
        {u.status === 'pending' && tab !== 'yonet' ? <Link href="?sekme=yonet" className="h-10 px-4 rounded-full bg-acc text-acc-ink text-[13px] font-extrabold flex items-center shrink-0">Onayla</Link> : null}
      </section>
      <nav className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-bg/95 backdrop-blur" aria-label="Kullanıcı bölümleri">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-surface">
          {TABS.map(([k, l]) => <Link key={k} href={k === 'ozet' ? '?' : `?sekme=${k}`} replace scroll={false} aria-current={tab === k ? 'page' : undefined} data-testid={`tab-${k}`}
            className="h-10 rounded-full text-[13px] font-bold flex items-center justify-center text-mute aria-[current=page]:bg-ink aria-[current=page]:text-bg">{l}</Link>)}
        </div>
      </nav>

      {tab === 'ozet' ? (
        <>
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
          {u.adminNote ? <section className="card p-4 text-[13.5px]"><span className="text-mute text-[12px] font-bold block mb-1">Yönetici notu</span>{u.adminNote}</section> : null}
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
        </>
      ) : null}

      {tab === 'islemler' ? (
        <section className="flex flex-col gap-3" data-testid="activity">
          {groups.length === 0 ? <p className="card p-4 text-[13.5px] text-mute">Henüz kayıtlı işlem yok.</p> : null}
          {groups.map((g) => (
            <div key={g.key} className="card px-4 py-2">
              <h2 className="text-[12px] font-bold tracking-[0.05em] uppercase text-mute py-1.5">{g.label}</h2>
              <ol className="flex flex-col">
                {g.items.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 py-2 border-t border-line first:border-t-0" data-testid="activity-row" data-kind={a.kind}>
                    <span className="num text-[12.5px] text-mute w-11 shrink-0 pt-0.5">{hm(a.at)}</span>
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: KIND[a.kind] }} aria-hidden />
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14px] font-semibold break-words">{a.text}</span>
                      {a.detail ? <span className="text-[12px] text-mute truncate">{a.kind === 'login' ? device(a.detail) : a.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {acts.length ? <p className="text-[11.5px] text-mute text-center">Son {acts.length} işlem · saatler Türkiye saatiyle</p> : null}
        </section>
      ) : null}

      {tab === 'yonet' ? (
        <Manage u={{ id: u.id, username: u.username, status: u.status, aiDaily: u.aiDaily, note: u.adminNote ?? '', admin: d.admin, self: u.id === me.id }}
          stats={{ sessions: s.sessions, push: s.push, media: s.media, aiToday: s.ai_today }} defaultDaily={settings.userDaily} />
      ) : null}
    </div>
  )
}
