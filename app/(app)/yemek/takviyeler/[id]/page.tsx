import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getSupplement } from '@/lib/supplement-data'
import { TopBar } from '@/components/ui'
import SuppForm from '../SuppForm'

export const metadata: Metadata = { title: 'Takviye · DgFit' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  const s = Number.isInteger(Number(id)) ? await getSupplement(u.id, Number(id)) : null
  if (!s) notFound()
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/yemek/takviyeler" title={s.input.name} sub="Değişiklik bundan sonraki kayıtlara uygulanır" />
      <SuppForm id={s.id} init={s.input} />
    </div>
  )
}
