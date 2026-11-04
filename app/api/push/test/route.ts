import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { getUser, rateLimit } from '@/lib/auth'
import { sendToUser } from '@/lib/push'
import { dayString } from '@/lib/time'
import { minuteOfDay } from '@/lib/water-data'

export async function POST() {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  if (!rateLimit('push-test:' + u.id, 5, 10 * 60 * 1000)) return NextResponse.json({ error: 'Çok sık deneme' }, { status: 429 })
  const now = new Date()
  const [row] = await db.insert(schema.waterReminders).values({ userId: u.id, day: dayString(now), minute: minuteOfDay(now), kind: 'test', title: 'DgFit bildirimleri açık', body: 'Su hatırlatmaları bu cihaza gelecek. Butonları denemek için “200 ml içtim”e dokun.' }).returning()
  const delivered = await sendToUser(u.id, {
    title: row.title, body: row.body, tag: 'water-test', url: `/su?hatirlatma=${row.id}`, reminderId: row.id,
    actions: [{ action: 'add:200', title: '200 ml içtim' }, { action: 'snooze', title: 'Sonra' }],
  })
  return NextResponse.json({ ok: delivered > 0, delivered })
}
