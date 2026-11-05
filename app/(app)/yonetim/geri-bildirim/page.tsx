import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { listFeedback } from '@/lib/admin-data'
import { FEEDBACK_KINDS, FEEDBACK_STATUS, type FeedbackKind, type FeedbackStatus } from '@/lib/access'
import { TopBar } from '@/components/ui'
import { Bug, Bulb, Flag, Help, Image as ImageIcon, Next } from '@/components/icons'
import { Chips, ago } from '../ui'

export const metadata: Metadata = { title: 'Geri bildirimler · Yönetim' }
export const dynamic = 'force-dynamic'
const ICON = { oneri: Bulb, hata: Bug, sikayet: Flag, diger: Help } as const
const FB_STATUS_CLS: Record<string, string> = { new: 'bg-acc text-acc-ink', seen: 'bg-surface-3 text-ink-2', done: 'bg-good/15 text-good' }

export default async function Page(props: { searchParams: Promise<{ durum?: string; tur?: string }> }) {
  await requireAdmin()
  const sp = await props.searchParams
  const status = ['new', 'seen', 'done', 'all'].includes(sp.durum ?? '') ? sp.durum! : 'open'
  const kind = sp.tur && sp.tur in FEEDBACK_KINDS ? sp.tur : ''
  const { rows, counts } = await listFeedback({ status: status === 'all' ? undefined : status, kind: kind || undefined })
  const href = (o: { durum?: string; tur?: string }) => {
    const u = new URLSearchParams(); const d = o.durum ?? status; if (d !== 'open') u.set('durum', d)
    const t = o.tur ?? kind; if (t) u.set('tur', t)
    const s = u.toString(); return '/yonetim/geri-bildirim' + (s ? '?' + s : '')
  }
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-feedback">
      <TopBar back="/yonetim" title="Geri bildirimler" sub={`${counts.new} yeni · ${counts.open} açık · ${counts.all} toplam`} />
      <Chips items={[
        { href: href({ durum: 'open' }), label: 'Açık', n: counts.open, on: status === 'open' },
        { href: href({ durum: 'new' }), label: 'Yeni', n: counts.new, on: status === 'new' },
        { href: href({ durum: 'done' }), label: 'Çözüldü', n: counts.done, on: status === 'done' },
        { href: href({ durum: 'all' }), label: 'Tümü', n: counts.all, on: status === 'all' },
      ]} />
      <Chips items={[{ href: href({ tur: '' }), label: 'Her tür', on: !kind }, ...(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => ({ href: href({ tur: k }), label: FEEDBACK_KINDS[k].label, on: kind === k }))]} />
      <div className="flex flex-col gap-2">
        {rows.length ? rows.map(({ f, username }) => {
          const I = ICON[f.kind as FeedbackKind] ?? Help
          return (
            <Link key={f.id} href={`/yonetim/geri-bildirim/${f.id}`} className="card p-4 flex gap-3 active:scale-[0.99] transition" data-testid="fb-row">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.status === 'new' ? 'bg-acc text-acc-ink' : 'bg-surface-3 text-ink-2'}`}><I size={19} /></span>
              <span className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="flex items-center gap-1.5 flex-wrap text-[12.5px]">
                  <b className="text-[14px]">{FEEDBACK_KINDS[f.kind as FeedbackKind]?.label ?? f.kind}</b>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${FB_STATUS_CLS[f.status]}`}>{FEEDBACK_STATUS[f.status as FeedbackStatus]}</span>
                  {f.area ? <span className="text-mute">· {f.area}</span> : null}
                </span>
                <span className="text-[14px] text-ink-2 line-clamp-2 break-words">{f.body}</span>
                <span className="text-[12px] text-mute flex items-center gap-1.5">@{username} · {ago(f.createdAt)}{f.mediaId ? <><ImageIcon size={13} /> görsel</> : null}{f.reply ? ' · yanıtlandı' : ''}</span>
              </span>
              <Next size={18} className="text-mute shrink-0 self-center" />
            </Link>
          )
        }) : <p className="card p-5 text-[14px] text-mute text-center">Bu filtrede geri bildirim yok.</p>}
      </div>
    </div>
  )
}
