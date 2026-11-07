import { requireUser } from '@/lib/auth'
import { activeDesign } from '@/lib/cards/design-data'
import { normalizeModuleColors } from '@/lib/cards/colors'
import { TopBar } from '@/components/ui'
import ModuleColors from './ModuleColors'

export const metadata = { title: 'Renkler' }

/** Ö2a: modül renkleri, hazır paletler, fotoğraftan palet. Kart başına renkler ekranda ✎ → Renkler'den. */
export default async function Page() {
  const u = await requireUser()
  const d = await activeDesign(u.id)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil/ozellestirme" title="Renkler" sub="Modül renkleri ve paletler" />
      <ModuleColors initial={normalizeModuleColors(d?.modules) ?? {}} />
    </div>
  )
}
