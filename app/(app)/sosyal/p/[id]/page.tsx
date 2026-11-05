import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { postDetail } from '@/lib/social-data'
import { TopBar } from '@/components/ui'
import PostCard from '@/components/social/PostCard'
import Comments from './Comments'

export const metadata: Metadata = { title: 'Gönderi · DgFit' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  const d = /^[0-9a-f-]{36}$/.test(id) ? await postDetail(u.id, id) : null
  if (!d) notFound()
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Gönderi" />
      <PostCard p={d.post} detail />
      <Comments postId={id} comments={d.comments} />
    </div>
  )
}
