import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { markReminder } from '@/lib/scheduler'
import { addWater } from '@/app/(app)/su/actions'

const Body = z.object({ reminderId: z.number().int().positive().optional(), action: z.string().max(20) })

/** Service worker'dan gelen bildirim yanıtları: "add:200", "snooze", "open". Çerezle kimlik doğrulanır. */
export async function POST(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const p = Body.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'geçersiz' }, { status: 400 })
  const { reminderId, action } = p.data
  const m = action.match(/^add:(\d{2,4})$/)
  if (m) {
    const r = await addWater({ ml: Number(m[1]), source: 'notification', force: true })
    if (reminderId) await markReminder(u.id, reminderId, { action: 'add', opened: true })
    return NextResponse.json(r.ok ? { ok: true, ml: Number(m[1]) } : { ok: false, error: r.error })
  }
  if (reminderId) await markReminder(u.id, reminderId, action === 'snooze' ? { action: 'snooze' } : { opened: true, action: 'open' })
  return NextResponse.json({ ok: true })
}
