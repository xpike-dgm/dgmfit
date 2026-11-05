import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { thread } from '@/lib/social2-data'
import { TopBar } from '@/components/ui'
import Thread from './Thread'

export const metadata: Metadata = { title: 'Mesaj · DgFit' }

export default async function Page(props: { params: Promise<{ username: string }> }) {
  const u = await requireUser()
  const { username } = await props.params
  const t = await thread(u.id, decodeURIComponent(username))
  if (!t) notFound()
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <TopBar back="/sosyal/mesaj" title={t.username} />
      <Thread username={t.username} canSend={t.canSend} messages={t.messages} />
    </div>
  )
}
