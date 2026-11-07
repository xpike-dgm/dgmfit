import { requireUser } from '@/lib/auth'
import { dayString } from '@/lib/time'
import { getModes } from '@/lib/modes-data'
import { activeDesign } from '@/lib/cards/design-data'
import StudioHeader from '@/components/cards/StudioHeader'
import ModesForm from './ModesForm'

export const metadata = { title: 'Modlar' }

/** Ö5b/Ö6: odak modları (2×2), Ramazan modu, zamana göre düzen / antrenman günü / kurallar / tek el. */
export default async function Page() {
  const u = await requireUser()
  const [s, d] = await Promise.all([getModes(u.id), activeDesign(u.id)])
  const rules = d?.rules ?? []
  const on = (id: string) => rules.some((r) => r.id === id && r.on)
  return (
    <div className="px-4 flex flex-col gap-3.5 pb-6" data-testid="modes">
      <StudioHeader back="/profil/ozellestirme" title="Modlar" />
      <ModesForm s={s} today={dayString()} extra={{ time: on('preset-morning') || on('preset-evening'), training: on('preset-training'), rules: rules.filter((r) => r.on).length, hand: d?.prefs?.hand ?? null }} />
    </div>
  )
}
