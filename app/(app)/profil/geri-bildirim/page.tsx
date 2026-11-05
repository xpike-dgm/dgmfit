import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { markRepliesSeen, myFeedback } from '@/lib/admin-data'
import { mediaEnabled } from '@/lib/media'
import { FEEDBACK_KINDS, FEEDBACK_STATUS, type FeedbackKind, type FeedbackStatus } from '@/lib/access'
import { TopBar } from '@/components/ui'
import FeedbackForm from './FeedbackForm'

export const metadata: Metadata = { title: 'Geri bildirim · DgFit' }
const when = (d: Date) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
const STATUS_CLS: Record<string, string> = { new: 'bg-surface-3 text-ink-2', seen: 'bg-acc/15 text-acc', done: 'bg-good/15 text-good' }

export default async function Page() {
  const u = await requireUser()
  const list = await myFeedback(u.id)
  const unread = new Set(list.filter((f) => f.repliedAt && (!f.replySeenAt || f.replySeenAt < f.repliedAt)).map((f) => f.id))
  if (unread.size) await markRepliesSeen(u.id)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil" title="Geri bildirim" sub="İstek, şikayet ya da hata bize ulaşsın" />
      <FeedbackForm photo={mediaEnabled()} />
      <section className="flex flex-col gap-2 mt-2" aria-label="Gönderdiklerin" data-testid="my-feedback">
        <h2 className="text-[13px] font-bold tracking-[0.06em] uppercase text-mute px-1">Gönderdiklerin</h2>
        {list.length ? list.map((f) => (
          <article key={f.id} className={`card p-4 flex flex-col gap-2 ${unread.has(f.id) ? 'ring-2 ring-acc' : ''}`} data-testid="feedback-item">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full bg-surface-2 border border-line">{FEEDBACK_KINDS[f.kind as FeedbackKind]?.label ?? f.kind}</span>
              <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${STATUS_CLS[f.status] ?? ''}`} data-testid="feedback-status">{FEEDBACK_STATUS[f.status as FeedbackStatus] ?? f.status}</span>
              <span className="text-[12px] text-mute ml-auto">{when(f.createdAt)}</span>
            </div>
            <p className="text-[14px] text-ink-2 whitespace-pre-wrap break-words line-clamp-6">{f.body}</p>
            {f.mediaId ? <span className="text-[12px] text-mute">Ekran görüntüsü eklendi</span> : null}
            {f.reply ? (
              <div className="rounded-2xl bg-acc/10 border border-acc/30 p-3 flex flex-col gap-1" data-testid="feedback-reply">
                <span className="text-[12px] font-bold text-acc">DgFit yanıtı{f.repliedAt ? ` · ${when(f.repliedAt)}` : ''}{unread.has(f.id) ? ' · yeni' : ''}</span>
                <p className="text-[14px] whitespace-pre-wrap break-words">{f.reply}</p>
              </div>
            ) : null}
          </article>
        )) : <p className="card p-4 text-[14px] text-mute">Henüz bir şey göndermedin. Yazdığın her şeyi okuyoruz.</p>}
      </section>
    </div>
  )
}
