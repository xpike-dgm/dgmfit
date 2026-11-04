import 'server-only'
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
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
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
  return ok
}
