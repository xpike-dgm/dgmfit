import 'server-only'
import { pushAllowed, type PushKind } from './push-plan'
import { dayString } from './time'
import webpush from 'web-push'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from './db'

let ready: Promise<{ publicKey: string }> | null = null

/** VAPID anahtarları ilk kullanımda üretilip app_config'e yazılır; gizli anahtar hiçbir yere loglanmaz. */
export function vapid(): Promise<{ publicKey: string }> {
  if (!ready) {
    ready = (async () => {
      const [row] = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, 'vapid')).limit(1)
      let keys = row?.value as { publicKey: string; privateKey: string } | undefined
      if (!keys) {
        const k = webpush.generateVAPIDKeys()
        await db.insert(schema.appConfig).values({ key: 'vapid', value: k }).onConflictDoNothing()
        const [again] = await db.select().from(schema.appConfig).where(eq(schema.appConfig.key, 'vapid')).limit(1)
        keys = again.value as { publicKey: string; privateKey: string }
      }
      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:destek@dgmcraft.online', keys.publicKey, keys.privateKey)
      return { publicKey: keys.publicKey }
    })().catch((e) => { ready = null; throw e })
  }
  return ready
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  reminderId?: number
  actions?: { action: string; title: string }[]
}

/** Kullanıcının tüm aboneliklerine gönderir; 404/410 dönen abonelikler silinir. Başarılı gönderim sayısını döndürür. */
const sentToday = new Map<string, number>() // `${gün}|${kullanıcı}` → gönderilen otomatik bildirim (süreç içi)

export async function sendToUser(userId: string, payload: PushPayload, kind: PushKind = 'normal'): Promise<number> {
  // Faz 7-2: tek bildirim planlayıcısı — otomatik bildirimler günlük sınır + uyanık saatler
  const day = dayString(), key = `${day}|${userId}`
  if (kind !== 'urgent') {
    const [p] = await db.select({ wake: schema.profiles.wakeTime, sleep: schema.profiles.sleepTime }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
    const nowMin = Number(parts.find((x) => x.type === 'hour')!.value) * 60 + Number(parts.find((x) => x.type === 'minute')!.value)
    if (!pushAllowed({ kind, sentToday: sentToday.get(key) ?? 0, nowMin, wake: p?.wake, sleep: p?.sleep }).ok) return 0
  }
  await vapid()
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId))
  let ok = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 30, urgency: 'normal', topic: payload.tag?.slice(0, 32) })
      ok++
      await db.update(schema.pushSubscriptions).set({ lastOkAt: new Date(), failures: 0 }).where(eq(schema.pushSubscriptions.id, s.id))
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id))
      else await db.update(schema.pushSubscriptions).set({ failures: sql`${schema.pushSubscriptions.failures} + 1` }).where(eq(schema.pushSubscriptions.id, s.id))
    }
  }))
  if (ok && kind !== 'urgent') { sentToday.set(key, (sentToday.get(key) ?? 0) + 1); if (sentToday.size > 5000) for (const k of sentToday.keys()) if (!k.startsWith(day)) sentToday.delete(k) }
  return ok
}
