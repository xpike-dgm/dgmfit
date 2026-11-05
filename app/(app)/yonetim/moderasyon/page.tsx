import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { moderationQueue } from '@/lib/social-data'
import { TopBar } from '@/components/ui'
import { ModButton } from './ModButton'

export const metadata: Metadata = { title: 'Moderasyon · DgFit' }

export default async function Page() {
  await requireAdmin()
  const q = await moderationQueue()
  return (
    <div className="px-4 pt-5 flex flex-col gap-3" data-testid="moderation">
      <TopBar back="/profil" title="Moderasyon" />
      <section className="card p-4 flex flex-col gap-2"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Bekleyen / gizlenen gönderiler ({q.posts.length})</span>
        {q.posts.map((p) => (
          <div key={p.id} className="flex flex-col gap-1 border-b border-line last:border-0 pb-2" data-testid="mod-post">
            <span className="text-[13px]"><b>{p.username}</b> · {p.kind} · {p.moderation}{p.media ? ` · ${p.media} fotoğraf` : ''}</span>
            {p.body ? <span className="text-[13px] text-ink-2 whitespace-pre-wrap">{p.body}</span> : null}
            <span className="text-[12px] text-orange">{p.reason}</span>
            <div className="flex gap-2"><ModButton type="post" id={p.id} approve label="Yayınla" /><ModButton type="post" id={p.id} approve={false} label="Gizle" /></div>
          </div>
        ))}
      </section>
      <section className="card p-4 flex flex-col gap-2"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Bekleyen yorumlar ({q.comments.length})</span>
        {q.comments.map((c) => <div key={c.id} className="flex flex-col gap-1 border-b border-line last:border-0 pb-2"><span className="text-[13px]"><b>{c.username}</b>: {c.body}</span><div className="flex gap-2"><ModButton type="comment" id={c.id} approve label="Yayınla" /><ModButton type="comment" id={c.id} approve={false} label="Sil" /></div></div>)}
      </section>
      <section className="card p-4 flex flex-col gap-2"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Açık şikayetler ({q.reports.length})</span>
        {q.reports.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 border-b border-line last:border-0 pb-2" data-testid="mod-report">
            <span className="text-[13px]"><b>{r.reporter}</b> → {r.targetType} · {r.reason}{r.note ? ` · ${r.note}` : ''}</span>
            <div className="flex gap-2 items-center">
              {r.targetType === 'post' ? <><Link href={`/sosyal/p/${r.targetId}`} className="text-[12px] underline">Gönderiyi aç</Link><ModButton type="post" id={r.targetId} approve={false} label="Gönderiyi gizle" /></> : null}
              {r.targetType === 'comment' ? <ModButton type="comment" id={r.targetId} approve={false} label="Yorumu sil" /> : null}
              <ModButton type="report" id={r.id} approve label="Yoksay" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
