import { requireUser } from '@/lib/auth'
import { activeDesign, ruleCtx } from '@/lib/cards/design-data'
import { normalizeRules } from '@/lib/cards/prefs'
import StudioHeader from '@/components/cards/StudioHeader'
import { Lead } from '@/components/cards/StudioUI'
import RulesEditor from './RulesEditor'

export const metadata = { title: 'Kurallar' }

/** Ö1b-2: eğer–ise kuralları (zamana, güne, antrenman gününe, hedefe göre kartı üste al / gizle / göster). */
export default async function Page() {
  const u = await requireUser()
  const [d, x] = await Promise.all([activeDesign(u.id), ruleCtx(u.id)])
  return (
    <div className="px-4 flex flex-col gap-4 pb-6" data-mod="today">
      <StudioHeader back="/profil/ozellestirme/duzen" title="Kurallar" />
      <Lead>Saate, güne ya da antrenman gününe göre ekranın kendiliğinden değişsin.</Lead>
      <RulesEditor rules={normalizeRules(d?.rules ?? [])} now={x} />
    </div>
  )
}
