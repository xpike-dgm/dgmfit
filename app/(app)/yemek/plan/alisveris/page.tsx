import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { currentPlan, shoppingFor } from '@/lib/planner-data'
import { TopBar } from '@/components/ui'
import { AISLES } from '@/lib/menu'
import ShopList from './ShopList'

export const metadata: Metadata = { title: 'Alışveriş listesi · DgFit' }

export default async function Page(props: { searchParams: Promise<{ id?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const plan = await currentPlan(u.id, sp.id && /^[0-9a-f-]{36}$/.test(sp.id) ? sp.id : undefined)
  const items = plan ? await shoppingFor(u.id, plan.id) : []
  const groups = AISLES.map((a) => ({ aisle: a, items: items.filter((x) => x.aisle === a).map((x) => ({ id: x.id, name: x.name, grams: x.grams, checked: x.checked })) })).filter((g) => g.items.length)
  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back={plan ? `/yemek/plan?id=${plan.id}` : '/yemek/plan'} title="Alışveriş listesi" />
      {plan ? <ShopList groups={groups} /> : <p className="card p-5 text-[14px] text-mute">Önce bir AI menüsü oluştur.</p>}
    </div>
  )
}
