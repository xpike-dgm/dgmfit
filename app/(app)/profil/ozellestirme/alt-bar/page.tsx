import { requireUser } from '@/lib/auth'
import { activeDesign } from '@/lib/cards/design-data'
import { resolveNav } from '@/lib/cards/prefs'
import StudioHeader from '@/components/cards/StudioHeader'
import NavEditor from './NavEditor'

export const metadata = { title: 'Alt bar' }

/** Ö1b-2: alt bar düzeni — sekmelerin sırası ve gizlenenler. */
export default async function Page() {
  const u = await requireUser()
  const d = await activeDesign(u.id)
  const r = resolveNav(d?.nav)
  return (
    <div className="px-4 flex flex-col gap-3.5 pb-6">
      <StudioHeader back="/profil/ozellestirme/duzen" title="Alt bar" />
      <NavEditor order={[...r.visible, ...r.hidden]} hidden={r.hidden} custom={!!d?.nav} />
    </div>
  )
}
