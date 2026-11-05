import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { feedbackDetail } from '@/lib/admin-data'
import { FEEDBACK_KINDS, FEEDBACK_STATUS, type FeedbackKind, type FeedbackStatus } from '@/lib/access'
import { TopBar } from '@/components/ui'
import { ago } from '../../ui'
import Reply from './Reply'

export const metadata: Metadata = { title: 'Geri bildirim · Yönetim' }
export const dynamic = 'force-dynamic'
const dt = (d: Date) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d)

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await props.params
  const r = await feedbackDetail(id)
  if (!r) notFound()
  const { f } = r
  const dev = f.device ?? {}
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-feedback-detail">
      <TopBar back="/yonetim/geri-bildirim" title={FEEDBACK_KINDS[f.kind as FeedbackKind]?.label ?? 'Geri bildirim'} sub={`${FEEDBACK_STATUS[f.status as FeedbackStatus]} · ${dt(f.createdAt)}`} />
      <section className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <Link href={`/yonetim/kullanicilar/${f.userId}`} className="font-bold text-acc truncate">@{r.username}</Link>
          <span className="text-mute shrink-0">{f.area ?? 'bölüm belirtilmedi'} · {ago(f.createdAt)}</span>
        </div>
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words" data-testid="fb-body">{f.body}</p>
        {f.mediaId ? (
          <a href={`/api/feedback/${f.id}/image`} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/feedback/${f.id}/image`} alt="Ekran görüntüsü" className="max-h-[420px] rounded-2xl border border-line mx-auto" />
          </a>
        ) : null}
        <dl className="text-[12px] text-mute grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line pt-2.5">
          <dt>Ekran</dt><dd className="num break-all">{dev.screen || '—'}</dd>
          <dt>Tema</dt><dd>{dev.theme || '—'}</dd>
          <dt>Tarayıcı</dt><dd className="break-all">{dev.ua || '—'}</dd>
        </dl>
      </section>
      {f.reply ? (
        <section className="card p-4 flex flex-col gap-1 border border-acc/40">
          <span className="text-[12px] font-bold text-acc">Gönderilen yanıt{f.repliedAt ? ` · ${dt(f.repliedAt)}` : ''}{f.replySeenAt && f.repliedAt && f.replySeenAt >= f.repliedAt ? ' · okundu' : ' · henüz okunmadı'}</span>
          <p className="text-[14px] whitespace-pre-wrap break-words">{f.reply}</p>
        </section>
      ) : null}
      <Reply id={f.id} status={f.status} hasReply={!!f.reply} />
    </div>
  )
}
