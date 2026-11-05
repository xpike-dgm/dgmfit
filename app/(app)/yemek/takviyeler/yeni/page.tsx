import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import SuppForm from '../SuppForm'

export const metadata: Metadata = { title: 'Yeni takviye · DgFit' }

export default async function Page() {
  await requireUser()
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/yemek/takviyeler" title="Yeni takviye" sub="Etiketteki 1 porsiyon değerlerini gir" />
      <SuppForm id={null} />
    </div>
  )
}
