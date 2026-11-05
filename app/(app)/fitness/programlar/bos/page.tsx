import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { EmptyForm } from '../ProgramsClient'

export const metadata = { title: 'Boş program · DgFit' }

export default async function Page() {
  await requireUser()
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/programlar" title="Boş program" sub="Kendi programını sıfırdan kur" />
      <EmptyForm />
    </div>
  )
}
