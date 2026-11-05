import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { aiAvailable } from '@/lib/ai/engine'
import { currentPlan } from '@/lib/planner-data'
import { dayString, shortDate } from '@/lib/time'
import { TopBar } from '@/components/ui'
import PlanClient from './PlanClient'

export const metadata: Metadata = { title: 'AI menü · DgFit' }

export default async function Page(props: { searchParams: Promise<{ id?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const [plan, on] = await Promise.all([currentPlan(u.id, sp.id && /^[0-9a-f-]{36}$/.test(sp.id) ? sp.id : undefined), aiAvailable()])
  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back="/yemek" title="AI menü" right={plan ? <Link href={`/yemek/plan/alisveris?id=${plan.id}`} className="h-11 px-3 rounded-full bg-surface-2 text-[13px] font-bold inline-flex items-center">Alışveriş</Link> : undefined} />
      <PlanClient aiOn={on} today={dayString()}
        plan={plan ? { id: plan.id, provider: plan.provider, prepSteps: plan.prepSteps, days: plan.days.map((d) => ({ ...d, label: shortDate(d.day), meals: d.meals.map((m) => ({ meal: m.meal, items: m.items.map((x) => ({ id: x.id, name: x.name, grams: x.grams, kcal: x.kcal, matched: x.foodId !== null, logged: !!x.loggedAt })) })) })) } : null} />
    </div>
  )
}
