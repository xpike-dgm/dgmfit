import { requireUser } from '@/lib/auth'
import { activeDesign, ruleCtx } from '@/lib/cards/design-data'
import { normalizeRules } from '@/lib/cards/prefs'
import { TopBar } from '@/components/ui'
import RulesEditor from './RulesEditor'

export const metadata = { title: 'Kurallar' }

/** Ö1b-2: eğer–ise kuralları (zamana, güne, antrenman gününe, hedefe göre kartı üste al / gizle / göster). */
export default async function Page() {
  const u = await requireUser()
  const [d, x] = await Promise.all([activeDesign(u.id), ruleCtx(u.id)])
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil/ozellestirme" title="Kurallar" sub="Eğer şu olursa, düzen şöyle olsun" />
      <RulesEditor rules={normalizeRules(d?.rules ?? [])} now={x} />
    </div>
  )
}
