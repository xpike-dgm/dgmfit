import 'server-only'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { on, publish } from './events'
import { sendToUser } from './push'
import { decideReminder, type SentReminder } from './reminders'
import { goalForDay, parseHm } from './water'
import { dayBounds, goalHistory, minuteOfDay } from './water-data'
import { addDays, dayString, TZ } from './time'
import { closePendingDays } from './fit-data'
import { waterBonusByDay } from './burn'

const ACT_WINDOW_MIN = 20
const g = globalThis as unknown as { __dgfitScheduler?: { timer: ReturnType<typeof setInterval>; running: boolean; closedFor?: string; reportFor?: string } }

/** Sunucu açılışında bir kez çağrılır (instrumentation.ts). Tek süreçte tek zamanlayıcı. */
export function startScheduler() {
  if (g.__dgfitScheduler) return
  const state = { timer: setInterval(() => void tick(), 60_000), running: false }
  g.__dgfitScheduler = state
  // Su kaydı → son 20 dakikadaki hatırlatma "işe yaradı"
  on('water.logged', async (userId) => {
    await db.update(schema.waterReminders).set({ actedAt: new Date() }).where(and(
      eq(schema.waterReminders.userId, userId), eq(schema.waterReminders.kind, 'remind'), isNull(schema.waterReminders.actedAt),
      gte(schema.waterReminders.sentAt, new Date(Date.now() - ACT_WINDOW_MIN * 60000)),
    ))
  })
  console.log('[dgfit] hatırlatma zamanlayıcısı başladı')
}

async function tick() {
  const s = g.__dgfitScheduler
  if (!s || s.running) return
  s.running = true
  try {
    // Fit: her gün 03.00'ten sonra dünü (ve kapanmamış son 7 günü) kapat
    const now = new Date(), today = dayString(now)
    if (s.closedFor !== today && minuteOfDay(now) >= 180) {
      s.closedFor = today
      const active = await db.selectDistinct({ userId: schema.goals.userId }).from(schema.goals).where(eq(schema.goals.active, true))
      let n = 0
      for (const u of active) {
        try { n += await closePendingDays(u.userId, now) } catch (e) { console.error('[dgfit] gün kapanış hatası', e) }
      }
      if (n) console.log(`[dgfit] ${n} gün kapatıldı`)
    }
    // Haftalık rapor bildirimi: Pazar 19.00'dan sonra ilk tikte, haftada bir (spesifikasyon 10: "Pazar akşamı")
    if (new Date(today + 'T12:00:00Z').getUTCDay() === 0 && minuteOfDay(now) >= 19 * 60 && s.reportFor !== today) {
      s.reportFor = today
      try { await sendWeeklyPushes(addDays(today, -6)) } catch (e) { console.error('[dgfit] haftalık rapor bildirimi hatası', e) }
    }
    const users = await db.selectDistinct({ userId: schema.pushSubscriptions.userId }).from(schema.pushSubscriptions)
      .innerJoin(schema.waterSettings, eq(schema.waterSettings.userId, schema.pushSubscriptions.userId))
      .where(eq(schema.waterSettings.remindersEnabled, true))
    for (const u of users) {
      try { await runForUser(u.userId) } catch (e) { console.error('[dgfit] hatırlatma hatası', e) }
    }
  } finally {
    s.running = false
  }
}

/** Haftalık rapor push'u: aboneliği olan ve kapatmamış kullanıcılara haftada bir. Test için dışa açık. */
export async function sendWeeklyPushes(weekStart: string, onlyUser?: string): Promise<number> {
  const subs = await db.selectDistinct({ userId: schema.pushSubscriptions.userId }).from(schema.pushSubscriptions)
    .leftJoin(schema.coachPrefs, eq(schema.coachPrefs.userId, schema.pushSubscriptions.userId))
    .where(and(sql`coalesce(${schema.coachPrefs.weeklyPush}, true)`, onlyUser ? eq(schema.pushSubscriptions.userId, onlyUser) : undefined))
  let n = 0
  for (const u of subs) {
    const [done] = await db.select({ id: schema.events.id }).from(schema.events)
      .where(and(eq(schema.events.userId, u.userId), eq(schema.events.type, 'report.pushed'), sql`${schema.events.payload}->>'week' = ${weekStart}`)).limit(1)
    if (done) continue
    const ok = await sendToUser(u.userId, { title: 'Haftalık raporun hazır', body: 'Kalori, su ve antrenman haftanın özeti ve koçun önerileri seni bekliyor.', tag: 'weekly-report', url: '/rapor' })
    await publish(u.userId, 'report.pushed', { week: weekStart, delivered: ok })
    if (ok) n++
  }
  return n
}

/** Bir kullanıcı için kararı verir ve gerekiyorsa gönderir. Test için dışa açık. */
export async function runForUser(userId: string, nowDate = new Date()) {
  const day = dayString(nowDate)
  const now = minuteOfDay(nowDate)
  const [[settings], [profile], history] = await Promise.all([
    db.select().from(schema.waterSettings).where(eq(schema.waterSettings.userId, userId)).limit(1),
    db.select({ wake: schema.profiles.wakeTime, sleep: schema.profiles.sleepTime }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
    goalHistory(userId),
  ])
  if (!settings?.remindersEnabled) return { sent: false, reason: 'kapalı' }
  const [start, end] = dayBounds(day)
  const logs = await db.select({ at: schema.waterLogs.loggedAt, ml: schema.waterLogs.effectiveMl }).from(schema.waterLogs)
    .where(and(eq(schema.waterLogs.userId, userId), isNull(schema.waterLogs.deletedAt), gte(schema.waterLogs.loggedAt, start), sql`${schema.waterLogs.loggedAt} < ${end.toISOString()}`))
  const total = logs.reduce((a, l) => a + l.ml, 0)
  const lastDrink = logs.length ? Math.max(...logs.map((l) => minuteOfDay(l.at))) : null

  const sentRows = await db.select().from(schema.waterReminders).where(and(eq(schema.waterReminders.userId, userId), eq(schema.waterReminders.day, day))).orderBy(schema.waterReminders.sentAt)
  // kullanıcının elle gönderdiği test bildirimleri gerçek hatırlatmaların aralığını etkilemez
  const sentToday: SentReminder[] = sentRows.filter((r) => r.kind !== 'test').map((r) => ({
    at: r.minute, kind: r.kind as SentReminder['kind'],
    acted: r.actedAt ? true : nowDate.getTime() - r.sentAt.getTime() > ACT_WINDOW_MIN * 60000 ? false : null,
  }))

  // Son 14 gün: saatlik alışkanlık ve hatırlatma etkinliği
  const [hStart] = dayBounds(addDays(day, -14))
  const habitRows = await db.execute<{ h: number; total: number }>(sql`
    select extract(hour from logged_at at time zone ${TZ})::int as h, sum(effective_ml)::int as total from water_logs
    where user_id = ${userId} and deleted_at is null and logged_at >= ${hStart.toISOString()} and logged_at < ${start.toISOString()} group by 1`)
  const habit = Array(24).fill(0)
  for (const r of habitRows) habit[Number(r.h)] = Math.round(Number(r.total) / 14)
  const statRows = await db.execute<{ h: number; sent: number; acted: number }>(sql`
    select (minute / 60)::int as h, count(*)::int as sent, count(acted_at)::int as acted from water_reminders
    where user_id = ${userId} and kind = 'remind' and day >= ${addDays(day, -14)} and day < ${day} group by 1`)
  const hourStats = Array.from({ length: 24 }, () => ({ sent: 0, acted: 0 }))
  for (const r of statRows) hourStats[Number(r.h)] = { sent: Number(r.sent), acted: Number(r.acted) }

  const wake = parseHm(profile?.wake, 450), sleep = parseHm(profile?.sleep, 1410)
  let weakestHour: number | null = null
  for (let h = Math.ceil(wake / 60); h < Math.floor(sleep / 60) - 1; h++) if (weakestHour === null || habit[h] < habit[weakestHour]) weakestHour = h

  const d = decideReminder({
    now, wake, sleep, goal: goalForDay(history, day) + ((await waterBonusByDay(userId, day, day)).get(day) ?? 0), total, lastDrink, sentToday, habit, hourStats,
    maxPerDay: settings.maxPerDay, quiet: settings.quiet ?? [], summaryEnabled: settings.summaryEnabled, weakestHour,
  })
  if (!d.send) return { sent: false, reason: d.reason }
  const [row] = await db.insert(schema.waterReminders).values({ userId, day, minute: now, kind: d.kind, amount: d.amount, title: d.title, body: d.body }).returning({ id: schema.waterReminders.id })
  const delivered = await sendToUser(userId, {
    title: d.title, body: d.body, tag: d.tag, url: `/su?hatirlatma=${row.id}`, reminderId: row.id,
    actions: d.kind === 'remind' ? [{ action: `add:${d.amount}`, title: `${d.amount} ml içtim` }, { action: 'snooze', title: 'Sonra' }] : [],
  })
  await db.update(schema.waterReminders).set({ delivered }).where(eq(schema.waterReminders.id, row.id))
  return { sent: true, kind: d.kind, delivered, id: row.id }
}

/** Bildirim yanıtlarını kaydeder (service worker'dan). */
export async function markReminder(userId: string, id: number, patch: { opened?: boolean; action?: string }) {
  const set: Partial<typeof schema.waterReminders.$inferInsert> = {}
  if (patch.opened) set.openedAt = new Date()
  if (patch.action) set.action = patch.action
  if (!Object.keys(set).length) return
  await db.update(schema.waterReminders).set(set).where(and(eq(schema.waterReminders.id, id), eq(schema.waterReminders.userId, userId)))
}

export async function reminderStats(userId: string, days = 28) {
  const from = addDays(dayString(), -days)
  const rows = await db.select({ minute: schema.waterReminders.minute, actedAt: schema.waterReminders.actedAt }).from(schema.waterReminders)
    .where(and(eq(schema.waterReminders.userId, userId), eq(schema.waterReminders.kind, 'remind'), gte(schema.waterReminders.day, from)))
  const byHour = new Map<number, { s: number; a: number }>()
  for (const r of rows) { const h = Math.floor(r.minute / 60); const e = byHour.get(h) ?? { s: 0, a: 0 }; e.s++; if (r.actedAt) e.a++; byHour.set(h, e) }
  const best = [...byHour.entries()].filter(([, e]) => e.s >= 3).sort((a, b) => b[1].a / b[1].s - a[1].a / a[1].s)[0]
  return { sent: rows.length, acted: rows.filter((r) => r.actedAt).length, bestHour: best ? best[0] : null }
}

