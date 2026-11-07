import { requireUser } from '@/lib/auth'
import { TopBar } from '@/components/ui'
import { dayString } from '@/lib/time'
import { getModes } from '@/lib/modes-data'
import ModesForm from './ModesForm'

export const metadata = { title: 'Modlar' }

/** Ö5b: odak modları (Antrenman / Diyet / Tatil / Hastalık) ve Ramazan modu. */
export default async function Page() {
  const u = await requireUser()
  const s = await getModes(u.id)
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="modes">
      <TopBar back="/profil/ozellestirme" title="Modlar" sub="Odak, tatil, hastalık, Ramazan" />
      <ModesForm s={s} today={dayString()} />
    </div>
  )
}
