import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import Wizard from './Wizard'

export const metadata = { title: 'Düzen sihirbazı' }

/** Ö1b-3: düzen sihirbazı — 5 soru → Bugün düzeni, alt bar, tek el, hazır kurallar. */
export default async function Page() {
  await requireUser()
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil/ozellestirme" title="Düzen sihirbazı" sub="5 soruda sana göre düzen" />
      <Wizard />
    </div>
  )
}
