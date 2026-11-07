import { requireUser } from '@/lib/auth'
import { activeDesign, userStyle } from '@/lib/cards/design-data'
import { normalizeModuleColors } from '@/lib/cards/colors'
import StudioHeader from '@/components/cards/StudioHeader'
import ColorsStyle from './ColorsStyle'

export const metadata = { title: 'Renkler ve stil' }

/** Ö6: Renkler ve stil (gösterilen tasarım) — paletler, modül renkleri, köşe/yazı tipi/yoğunluk; ayrıntılar "Daha fazla"da. */
export default async function Page() {
  const u = await requireUser()
  const [d, st] = await Promise.all([activeDesign(u.id), userStyle(u.id)])
  return (
    <div className="px-4 flex flex-col gap-3 pb-6">
      <StudioHeader back="/profil/ozellestirme" title="Renkler ve stil" />
      <ColorsStyle initial={normalizeModuleColors(d?.modules) ?? {}} style={st} />
    </div>
  )
}
