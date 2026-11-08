import { requireUser } from '@/lib/auth'
import { suggestMeals } from '@/lib/meal-builder-data'
import { MEALS, mealForTime, type MealId } from '@/lib/food'
import { minuteOfDay } from '@/lib/water-data'
import { TopBar } from '@/components/ui'
import MealPlanner from './MealPlanner'

export const metadata = { title: 'Kalanıma göre öner' }

/** Y2: öğün kurucu — kalan makrolar ve isteğe bağlı üst sınırlar → 2–3 besinlik öneriler, tek dokunuşla öğüne ekle. */
export default async function Page(props: { searchParams: Promise<{ ogun?: string; p?: string; k?: string; y?: string; kcal?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const num = (s?: string) => (s && /^\d{1,4}$/.test(s) ? Number(s) : null)
  const limits = { protein: num(sp.p), carb: num(sp.k), fat: num(sp.y), kcal: num(sp.kcal) }
  const meal = (MEALS.some((m) => m.id === sp.ogun) ? sp.ogun : mealForTime(minuteOfDay(new Date()))) as MealId
  const s = await suggestMeals(u.id, limits)
  return (
    <div className="px-4 flex flex-col gap-3 pb-6" data-mod="food">
      <TopBar back="/yemek" title="Kalanıma göre öner" sub="Veritabanından hesaplanır; sınır koyabilirsin" />
      <MealPlanner initial={s} meal={meal} />
    </div>
  )
}
