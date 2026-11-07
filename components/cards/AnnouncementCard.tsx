'use client'
// Ö3c: yönetimden duyuru kartı (Bugün'ün üstünde; kapatınca bu kullanıcıya bir daha gösterilmez).
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { communityAction } from '@/app/(app)/profil/ozellestirme/actions'

export default function AnnouncementCard({ a }: { a: { id: string; title: string; body: string; url: string | null } }) {
  const [gone, setGone] = useState(false)
  const [, start] = useTransition()
  if (gone) return null
  return (
    <section aria-label="Duyuru" className="card p-4 flex gap-3 border border-acc/40" data-testid="announcement">
      <span aria-hidden className="text-[20px] leading-none">📣</span>
      <span className="flex-1 flex flex-col gap-1 min-w-0">
        <b className="text-[15px]">{a.title}</b>
        {a.body ? <span className="text-[13.5px] text-ink-2 leading-snug">{a.body}</span> : null}
        {a.url ? <Link href={a.url} className="text-[13px] font-bold text-acc">Ayrıntı ›</Link> : null}
      </span>
      <button type="button" aria-label="Duyuruyu kapat" data-testid="announcement-close" className="w-9 h-9 -mt-1 -mr-1 rounded-full text-mute shrink-0"
        onClick={() => { setGone(true); start(async () => { await communityAction({ op: 'dismiss', id: a.id }).catch(() => null) }) }}>✕</button>
    </section>
  )
}
