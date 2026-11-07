import { requireUser } from '@/lib/auth'
import StudioHeader from '@/components/cards/StudioHeader'
import Wizard from './Wizard'

export const metadata = { title: 'Düzen sihirbazı' }

/** Ö1b-3: düzen sihirbazı — 5 soru → Bugün düzeni, alt bar, tek el, hazır kurallar. */
export default async function Page() {
  await requireUser()
  return (
    <div className="px-4 flex flex-col gap-3">
      <StudioHeader back="/profil/ozellestirme" title="Düzen sihirbazı" />
      <Wizard />
    </div>
  )
}
