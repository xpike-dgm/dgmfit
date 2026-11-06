import type { Metadata } from 'next'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { getDiary } from '@/lib/food-data'
import { getToday } from '@/lib/today'
import { mealForTime, type MealId } from '@/lib/food'
import { addDays, dayString, longDate } from '@/lib/time'
import { minuteOfDay } from '@/lib/water-data'
import { listSupplements } from '@/lib/supplement-data'
import FoodDiary from './FoodDiary'
import SupplementCard from './takviyeler/SupplementCard'
import { isAdvanced } from '@/lib/ui-mode'

export const metadata: Metadata = { title: 'Yemek' }

export default async function Page(props: { searchParams: Promise<{ gun?: string }> }) {
  const u = await requireUser()
  const { gun } = await props.searchParams
  const today = dayString()
  const day = gun && /^\d{4}-\d{2}-\d{2}$/.test(gun) && gun <= today && gun >= addDays(today, -365) ? gun : today
  const prevDay = addDays(day, -1)
  const [diary, t, prev, supp, adv] = await Promise.all([
    getDiary(u.id, day),
    getToday(u.id, day),
    db.select({ meal: schema.mealItems.meal, n: sql<number>`count(*)::int` }).from(schema.mealItems)
      .where(and(eq(schema.mealItems.userId, u.id), eq(schema.mealItems.day, prevDay), isNull(schema.mealItems.deletedAt))).groupBy(schema.mealItems.meal),
    listSupplements(u.id, day),
    isAdvanced(u.id),
  ])
  const yesterdayHas = Object.fromEntries(prev.map((r) => [r.meal, Number(r.n)])) as Record<MealId, number>
  return (
    <FoodDiary
      day={day} isToday={day === today} prevDay={prevDay} nextDay={day < today ? addDays(day, 1) : null} dayLabel={longDate(day)}
      meals={diary.meals} totals={diary.totals} micro={diary.micro}
      target={{ kcal: t?.target.kcal ?? 2000, protein: t?.target.protein ?? 120, carb: t?.target.carb ?? 200, fat: t?.target.fat ?? 65 }}
      adjust={t ? { base: t.target.base, kcal: t.target.adjustment, closed: t.target.closed } : null} burned={t?.burned ?? 0} trained={(t?.burned ?? 0) > 0} suggested={day === today ? mealForTime(minuteOfDay(new Date())) : 'lunch'} yesterdayHas={yesterdayHas}
      supplements={<SupplementCard day={day} {...supp} />} hasSupplements={supp.items.length > 0} adv={adv}
    />
  )
}
