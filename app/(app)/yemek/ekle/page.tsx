import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { recentFoods, savedMealsFor, userFoods } from '@/lib/food-data'
import { getToday } from '@/lib/today'
import { mealForTime, type MealId } from '@/lib/food'
import { addDays, dayString } from '@/lib/time'
import { minuteOfDay } from '@/lib/water-data'
import AddFood from './AddFood'

export const metadata: Metadata = { title: 'Besin ekle' }
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']

export default async function Page(props: { searchParams: Promise<{ ogun?: string; gun?: string; barkod?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const today = dayString()
  const day = sp.gun && /^\d{4}-\d{2}-\d{2}$/.test(sp.gun) && sp.gun <= today && sp.gun >= addDays(today, -365) ? sp.gun : today
  const meal = (MEALS.includes(sp.ogun ?? '') ? sp.ogun : mealForTime(minuteOfDay(new Date()))) as MealId
  const [recent, saved, mine, t] = await Promise.all([recentFoods(u.id), savedMealsFor(u.id), userFoods(u.id), getToday(u.id, day)])
  const remaining = t ? t.target.kcal + t.burned - t.eaten.kcal : 2000
  return (
    <AddFood day={day} meal={meal} remaining={remaining} startBarcode={sp.barkod === '1'}
      recent={recent} mine={mine} saved={saved.map((s) => ({ id: s.id, name: s.name, count: s.items.length }))} />
  )
}
