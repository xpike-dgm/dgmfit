import 'server-only'
import { redirect } from 'next/navigation'
import { getFitScreen, sexOf } from '@/lib/fit-data'
import { carbCycleFor } from '@/lib/planner-data'
import { fmtNum, type GoalType } from '@/lib/calc'

/** Fit ana sayfası ve araç sayfalarının (gunler, banka, checkin, senaryo, karb) ortak verisi. */
export async function loadFit(userId: string) {
  const s = await getFitScreen(userId)
  if (!s) redirect('/kurulum')
  const { goal, today, checkin } = s
  const [sex, cc] = await Promise.all([sexOf(userId), carbCycleFor(userId)])
  const type = goal.type as GoalType
  const trendNow = checkin?.trendNow ?? goal.startWeightKg
  return { s, goal, today, checkin, sex, cc, type, trendNow }
}

export const REASON: Record<string, string> = { balance: 'Dengeleme', 'bank-save': 'Banka birikimi', 'bank-spend': 'Banka harcaması' }
const WD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
export const wd = (d: string) => WD[new Date(d + 'T12:00:00Z').getUTCDay()]
export function signed(n: number) { return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n))}` }
export function groupReasons(list: { kcal: number; reason: string; sourceDay: string | null }[]) {
  const m = new Map<string, { kcal: number; reason: string; sourceDay: string | null }>()
  for (const r of list) {
    const k = r.reason + (r.sourceDay ?? '')
    const e = m.get(k)
    if (e) e.kcal += r.kcal; else m.set(k, { ...r })
  }
  return [...m.values()]
}
