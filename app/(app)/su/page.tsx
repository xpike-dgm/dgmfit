import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { getWaterScreen } from '@/lib/water-data'
import { addDays, dayString } from '@/lib/time'
import WaterScreen from './WaterScreen'
import { screenLayout } from '@/lib/cards/design-data'

export const metadata: Metadata = { title: 'Su' }

export default async function Page(props: { searchParams: Promise<{ gun?: string; duzenle?: string }> }) {
  const u = await requireUser()
  const { gun, duzenle } = await props.searchParams
  const today = dayString()
  const day = gun && /^\d{4}-\d{2}-\d{2}$/.test(gun) && gun < today && gun >= addDays(today, -365) ? gun : today
  const [data, l] = await Promise.all([getWaterScreen(u.id, day), screenLayout(u.id, 'water', { editing: duzenle === '1' })])
  const layout = { items: l.items.map((i) => ({ id: i.id, size: i.size })), drawer: l.drawer.map((d) => ({ id: d.def.id, reason: d.reason })), notices: l.notices, applied: l.applied }
  return <WaterScreen key={day} data={data} layout={layout} editing={duzenle === '1'} />
}
