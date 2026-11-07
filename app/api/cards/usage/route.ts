import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser, rateLimit } from '@/lib/auth'
import { recordUsage } from '@/lib/cards/usage-data'

const Body = z.object({ events: z.array(z.object({ card: z.string().min(3).max(60), kind: z.enum(['view', 'tap']) })).min(1).max(60) })

/** Ö4: kart kullanımı (görülme/dokunma) — sendBeacon ile toplu gelir. Yalnız kayıtlı kart kimlikleri sayılır. */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return new NextResponse(null, { status: 401 })
  if (!rateLimit('usage:' + u.id, 600, 3600_000)) return new NextResponse(null, { status: 429 })
  const p = Body.safeParse(await req.json().catch(() => null))
  if (!p.success) return new NextResponse(null, { status: 400 })
  await recordUsage(u.id, p.data.events)
  return new NextResponse(null, { status: 204 })
}
