import { requireUser } from '@/lib/auth'
import { activeDesign } from '@/lib/cards/design-data'
import { resolveNav } from '@/lib/cards/prefs'
import { TopBar } from '@/components/ui'
import NavEditor from './NavEditor'

export const metadata = { title: 'Alt bar' }

/** Ö1b-2: alt bar düzeni — sekmelerin sırası ve gizlenenler. */
export default async function Page() {
  const u = await requireUser()
  const d = await activeDesign(u.id)
  const r = resolveNav(d?.nav)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil/ozellestirme" title="Alt bar" sub="Sekmelerin sırası ve görünürlüğü" />
      <NavEditor order={[...r.visible, ...r.hidden]} hidden={r.hidden} custom={!!d?.nav} />
    </div>
  )
}
