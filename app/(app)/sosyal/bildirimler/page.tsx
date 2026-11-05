import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { notificationsFor } from '@/lib/social-data'
import { TopBar } from '@/components/ui'
import { ReadAll } from './ReadAll'

export const metadata: Metadata = { title: 'Bildirimler · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const list = await notificationsFor(u.id)
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Bildirimler" right={list.some((n) => !n.read) ? <ReadAll /> : undefined} />
      <ul className="card px-4 py-2 flex flex-col" data-testid="notifications">
        {list.length ? list.map((n) => (
          <li key={n.id} className={`min-h-12 flex items-center gap-2 border-b border-line last:border-0 ${n.read ? 'text-ink-2' : 'font-bold'}`} data-testid="notification" data-kind={n.kind}>
            {!n.read ? <span className="w-2 h-2 rounded-full bg-lime shrink-0" aria-label="okunmadı" /> : null}
            <Link href={n.postId ? `/sosyal/p/${n.postId}` : n.kind.startsWith('friend') ? '/sosyal/arkadaslar' : `/u/${n.actor}`} className="flex-1 text-[14px]">{n.text}</Link>
            <span className="text-[11px] text-mute">{new Date(n.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}</span>
          </li>
        )) : <li className="py-4 text-[14px] text-mute">Bildirim yok.</li>}
      </ul>
    </div>
  )
}
