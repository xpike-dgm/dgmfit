import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { getWaterScreen } from '@/lib/water-data'
import { addDays, dayString } from '@/lib/time'
import WaterScreen from './WaterScreen'

export const metadata: Metadata = { title: 'Su' }

export default async function Page(props: { searchParams: Promise<{ gun?: string }> }) {
  const u = await requireUser()
  const { gun } = await props.searchParams
  const today = dayString()
  const day = gun && /^\d{4}-\d{2}-\d{2}$/.test(gun) && gun < today && gun >= addDays(today, -365) ? gun : today
  const data = await getWaterScreen(u.id, day)
  return <WaterScreen key={day} data={data} />
}
