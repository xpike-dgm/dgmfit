import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { moderationQueue } from '@/lib/social-data'
import { proofQueue } from '@/lib/social2-data'
import { ProofButton } from './ModButton'
import { TopBar } from '@/components/ui'
import { ModButton } from './ModButton'

export const metadata: Metadata = { title: 'Moderasyon · DgFit' }

export default async function Page() {
  await requireAdmin()
  const [q, proofs] = await Promise.all([moderationQueue(), proofQueue()])
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="moderation">
      <TopBar back="/yonetim" title="Moderasyon" />
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
      <section className="card p-4 flex flex-col gap-2" data-testid="mod-proofs"><span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Rekor kanıtları ({proofs.length})</span>
        {proofs.map((p) => (
          <div key={p.id} className="flex flex-col gap-1 border-b border-line last:border-0 pb-2" data-testid="mod-proof">
            <span className="text-[13px]"><b>{p.username}</b> · {p.name} {p.value} kg · {p.reason}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.proof} alt="Kanıt" className="w-40 rounded-xl" />
            <div className="flex gap-2"><ProofButton id={p.id} approve label="Onayla" /><ProofButton id={p.id} approve={false} label="Reddet" /></div>
          </div>
        ))}
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
