import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { aiAvailable } from '@/lib/ai/engine'
import { mealForTime } from '@/lib/food'
import { minuteOfDay } from '@/lib/water-data'
import { TopBar } from '@/components/ui'
import RestaurantClient from './RestaurantClient'

export const metadata: Metadata = { title: 'Restoran modu · DgFit' }

export default async function Page() {
  await requireUser()
  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back="/yemek" title="Restoran modu" />
      <RestaurantClient aiOn={await aiAvailable()} meal={mealForTime(minuteOfDay(new Date()))} />
    </div>
  )
}
