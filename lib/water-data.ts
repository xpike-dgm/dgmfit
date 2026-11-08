import 'server-only'
import { waterBonusByDay } from './burn'
import { and, asc, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm'
import type { AnyColumn } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, currentDayStart, dayString, TZ } from './time'
import {
  computeStreak, frequentAmounts, goalForDay, parseHm, predict, distributionScore, longestGap, hourlyBuckets,
  idealAt, sipMl, DEFAULT_BUTTONS, type DayLog, type GoalRow, type Prediction, type StreakInfo, type DrinkId,
} from './water'

export interface WaterLogView {
  id: number
  atIso: string
  at: number // gün içi dakika
  ml: number
  effectiveMl: number
  drink: DrinkId
  containerId: string | null
  containerName: string | null
  source: string
  edited: boolean
}

export interface ContainerView { id: string; name: string; kind: string; capacityMl: number; lastFill: number; isDefault: boolean }

/** Gün sınırları (Europe/Istanbul, UTC+3 sabit). Y1: kullanıcının gün sınırı kadar kayar (04.00 → 04.00–04.00). */
export function dayBounds(day: string, dayStartMin = currentDayStart()): [Date, Date] {
  const start = new Date(new Date(`${day}T00:00:00+03:00`).getTime() + dayStartMin * 60000)
  return [start, new Date(start.getTime() + 86400000)]
}
/** SQL: zaman damgasının kullanıcının mantıksal günü (YYYY-MM-DD). */
export const sqlDay = (col: SQL | AnyColumn, dayStartMin = currentDayStart()) => sql`to_char((${col} - (${dayStartMin} * interval '1 minute')) at time zone ${TZ}, 'YYYY-MM-DD')`

export function minuteOfDay(d: Date): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const h = Number(p.find((x) => x.type === 'hour')?.value ?? 0) % 24
  const m = Number(p.find((x) => x.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

/** İlk kullanımda varsayılan ayarlar, hedef tarihçesi ve kaplar. */
export async function ensureWaterSetup(userId: string) {
  const [s] = await db.select({ u: schema.waterSettings.userId }).from(schema.waterSettings).where(eq(schema.waterSettings.userId, userId)).limit(1)
  if (s) return
  const [goal] = await db.select({ waterMl: schema.goals.waterMl, startDate: schema.goals.startDate }).from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.active, true))).limit(1)
  await db.transaction(async (tx) => {
    // eşzamanlı ilk açılışlarda (iki sekme, sayfa + su ekleme) yalnızca ayarları ilk yazan kurulumu yapar
    const created = await tx.insert(schema.waterSettings).values({ userId }).onConflictDoNothing().returning({ u: schema.waterSettings.userId })
    if (!created.length) return
    await tx.insert(schema.waterGoalHistory).values({ userId, effectiveFrom: goal?.startDate ?? dayString(), baseMl: goal?.waterMl ?? 2500, weekday: null })
    await tx.insert(schema.waterContainers).values([
      { userId, name: 'Bardak', kind: 'glass', capacityMl: 200, sort: 0 },
      { userId, name: 'Şişe', kind: 'bottle', capacityMl: 500, sort: 1, isDefault: true },
      { userId, name: 'Termos', kind: 'thermos', capacityMl: 750, sort: 2 },
    ])
  })
}

export async function goalHistory(userId: string): Promise<GoalRow[]> {
  const rows = await db.select().from(schema.waterGoalHistory).where(eq(schema.waterGoalHistory.userId, userId)).orderBy(asc(schema.waterGoalHistory.effectiveFrom), asc(schema.waterGoalHistory.id))
  return rows.map((r) => ({ effectiveFrom: r.effectiveFrom, baseMl: r.baseMl, weekday: r.weekday ?? null }))
}

/** Gün bazında efektif toplamlar [from, to] dahil. */
export async function dailyTotals(userId: string, from: string, to: string): Promise<Map<string, { total: number; count: number }>> {
  const [start] = dayBounds(from)
  const [, end] = dayBounds(to)
  const rows = await db.execute<{ day: string; total: number; count: number }>(sql`
    select ${sqlDay(sql`logged_at`)} as day, sum(effective_ml)::int as total, count(*)::int as count
    from water_logs where user_id = ${userId} and deleted_at is null and logged_at >= ${start.toISOString()} and logged_at < ${end.toISOString()}
    group by 1`)
  return new Map(rows.map((r) => [r.day, { total: Number(r.total), count: Number(r.count) }]))
}

async function logsBetween(userId: string, start: Date, end: Date) {
  return db.select({
    id: schema.waterLogs.id, loggedAt: schema.waterLogs.loggedAt, ml: schema.waterLogs.ml, effectiveMl: schema.waterLogs.effectiveMl,
    drink: schema.waterLogs.drink, containerId: schema.waterLogs.containerId, source: schema.waterLogs.source, history: schema.waterLogs.history,
    containerName: schema.waterContainers.name,
  }).from(schema.waterLogs)
    .leftJoin(schema.waterContainers, eq(schema.waterContainers.id, schema.waterLogs.containerId))
    .where(and(eq(schema.waterLogs.userId, userId), isNull(schema.waterLogs.deletedAt), gte(schema.waterLogs.loggedAt, start), lt(schema.waterLogs.loggedAt, end)))
    .orderBy(asc(schema.waterLogs.loggedAt), asc(schema.waterLogs.id))
}

export interface WaterScreen {
  /** Antrenmandan gelen su hedefi eki (ml), hedefe dahil */
  bonus: number
  day: string
  isToday: boolean
  /** Y1: gün başlangıcı (dk) — saat seçiminde gün başından önceki saatler ertesi takvim gününe düşer */
  dayStartMin: number
  nowMin: number
  wake: number
  sleep: number
  goal: number
  total: number
  logs: WaterLogView[]
  containers: ContainerView[]
  buttons: number[]
  frequent: number[]
  sipMl: number
  sipCalibrated: boolean
  idealNow: number
  prediction: Prediction | null
  distribution: number | null
  gap: { minutes: number; from: number; to: number } | null
  hourly: number[]
  streak: StreakInfo
  progressStyle: string
  feedback: boolean
}

export async function getWaterScreen(userId: string, day: string = dayString()): Promise<WaterScreen> {
  await ensureWaterSetup(userId)
  const today = dayString()
  const isToday = day === today
  const nowMin = isToday ? minuteOfDay(new Date()) : 24 * 60 - 1

  const [[settings], [profile], containersRows, history] = await Promise.all([
    db.select().from(schema.waterSettings).where(eq(schema.waterSettings.userId, userId)).limit(1),
    db.select({ wake: schema.profiles.wakeTime, sleep: schema.profiles.sleepTime }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
    db.select().from(schema.waterContainers).where(and(eq(schema.waterContainers.userId, userId), isNull(schema.waterContainers.archivedAt))).orderBy(asc(schema.waterContainers.sort), asc(schema.waterContainers.createdAt)),
    goalHistory(userId),
  ])
  const wake = parseHm(profile?.wake, 7 * 60 + 30)
  const sleep = parseHm(profile?.sleep, 23 * 60 + 30)
  const bonusToday = (await waterBonusByDay(userId, day, day)).get(day) ?? 0
  const goal = goalForDay(history, day) + bonusToday

  const [start, end] = dayBounds(day)
  const rows = await logsBetween(userId, start, end)
  const logs: WaterLogView[] = rows.map((r) => ({
    id: r.id, atIso: r.loggedAt.toISOString(), at: minuteOfDay(r.loggedAt), ml: r.ml, effectiveMl: r.effectiveMl,
    drink: r.drink as DrinkId, containerId: r.containerId, containerName: r.containerName ?? null, source: r.source,
    edited: (r.history ?? []).some((h) => h.action === 'edit'),
  }))
  const dayLogs: DayLog[] = logs.map((l) => ({ at: l.at, ml: l.effectiveMl }))
  const total = dayLogs.reduce((a, l) => a + l.ml, 0)

  // geçmiş 21 gün (tahmin) ve 30 gün (sık miktarlar)
  const [pStart] = dayBounds(addDays(day, -30))
  const pastRows = await logsBetween(userId, pStart, start)
  const byDay = new Map<string, DayLog[]>()
  const freqInput: { ml: number; at: number; daysAgo: number }[] = []
  for (const r of pastRows) {
    const d = dayString(r.loggedAt)
    const at = minuteOfDay(r.loggedAt)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push({ at, ml: r.effectiveMl })
    const daysAgo = Math.round((start.getTime() - dayBounds(d)[0].getTime()) / 86400000)
    freqInput.push({ ml: r.ml, at, daysAgo })
  }
  for (const l of logs) freqInput.push({ ml: l.ml, at: l.at, daysAgo: 0 })
  const past21 = [...byDay.entries()].filter(([d]) => d >= addDays(day, -21)).map(([, v]) => v)

  // seri: son 120 gün
  const sFrom = addDays(today, -119)
  const [totals, sBonus] = await Promise.all([dailyTotals(userId, sFrom, today), waterBonusByDay(userId, sFrom, today)])
  const days = Array.from({ length: 120 }, (_, i) => {
    const d = addDays(sFrom, i)
    return { day: d, total: totals.get(d)?.total ?? 0, goal: goalForDay(history, d) + (sBonus.get(d) ?? 0) }
  })
  // hesabı açılmadan önceki günleri seriye katma
  const firstActive = days.findIndex((d) => d.total > 0)
  const streak = computeStreak(firstActive >= 0 ? days.slice(firstActive) : days.slice(-1))

  return {
    day, isToday, dayStartMin: currentDayStart(), nowMin, wake, sleep, goal, total, logs, bonus: bonusToday,
    containers: containersRows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, capacityMl: c.capacityMl, lastFill: c.lastFill, isDefault: c.isDefault })),
    buttons: (settings?.buttons?.length ? settings.buttons : DEFAULT_BUTTONS).slice(0, 8),
    frequent: frequentAmounts(freqInput, nowMin, 3),
    sipMl: sipMl(settings?.sipMl),
    sipCalibrated: !!settings?.sipMl,
    idealNow: isToday ? idealAt(goal, wake, sleep, nowMin) : goal,
    prediction: isToday ? predict(dayLogs, past21, goal, wake, sleep, nowMin) : null,
    distribution: distributionScore(dayLogs, wake, sleep, isToday ? nowMin : undefined),
    gap: isToday ? longestGap(dayLogs, wake, nowMin) : null,
    hourly: hourlyBuckets(dayLogs),
    streak,
    progressStyle: settings?.progressStyle ?? 'ring',
    feedback: settings?.feedback ?? true,
  }
}

/** Bugün ekranı ve hafta şeridi için hafif özet. */
export async function getWaterSummary(userId: string, from: string, to: string) {
  const today = dayString()
  const [history, totals, bonus] = await Promise.all([goalHistory(userId), dailyTotals(userId, from, to), waterBonusByDay(userId, from < today ? from : today, to > today ? to : today)])
  const todayGoal = goalForDay(history, today) + (bonus.get(today) ?? 0)
  const out = new Map<string, { total: number; goal: number }>()
  for (let d = from; d <= to; d = addDays(d, 1)) out.set(d, { total: totals.get(d)?.total ?? 0, goal: goalForDay(history, d) + (bonus.get(d) ?? 0) })
  return { days: out, todayGoal, hasSetup: history.length > 0 }
}

export interface WaterStats {
  range: number
  days: { day: string; total: number; goal: number; count: number }[]
  avg: number
  prevAvg: number | null
  metRate: number
  best: { day: string; total: number } | null
  worst: { day: string; total: number } | null
  totalMl: number
  avgCount: number
  weekdayRate: { label: string; rate: number; n: number }[]
  hourlyAvg: number[]
  weakest: { from: number; to: number; avg: number } | null
  streak: StreakInfo
  activeDays: number
}

const WD = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

export async function getWaterStats(userId: string, range: number): Promise<WaterStats> {
  await ensureWaterSetup(userId)
  const today = dayString()
  const from = addDays(today, -(range - 1))
  const prevFrom = addDays(from, -range)
  const history = await goalHistory(userId)
  const [totals, bonus] = await Promise.all([dailyTotals(userId, prevFrom, today), waterBonusByDay(userId, prevFrom, today)])
  const all = Array.from({ length: range * 2 }, (_, i) => {
    const d = addDays(prevFrom, i)
    const t = totals.get(d)
    return { day: d, total: t?.total ?? 0, count: t?.count ?? 0, goal: goalForDay(history, d) + (bonus.get(d) ?? 0) }
  })
  // ilk kayıttan önceki günleri hesaba katma
  const firstIdx = all.findIndex((d) => d.count > 0)
  const firstDay = firstIdx >= 0 ? all[firstIdx].day : today
  const cur = all.slice(range).filter((d) => d.day >= firstDay || d.day === today)
  const prev = all.slice(0, range).filter((d) => d.day >= firstDay)
  const closed = cur.filter((d) => d.day !== today)
  const basis = closed.length ? closed : cur
  const avg = basis.length ? Math.round(basis.reduce((a, d) => a + d.total, 0) / basis.length) : 0
  const prevAvg = prev.length >= Math.min(3, range) ? Math.round(prev.reduce((a, d) => a + d.total, 0) / prev.length) : null
  const metRate = basis.length ? basis.filter((d) => d.total >= d.goal).length / basis.length : 0
  const withLogs = basis.filter((d) => d.count > 0)
  const best = withLogs.length ? withLogs.reduce((a, b) => (b.total > a.total ? b : a)) : null
  const worst = withLogs.length ? withLogs.reduce((a, b) => (b.total < a.total ? b : a)) : null

  const weekdayRate = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const ds = basis.filter((d) => new Date(d.day + 'T12:00:00Z').getUTCDay() === dow)
    return { label: WD[dow], n: ds.length, rate: ds.length ? ds.filter((d) => d.total >= d.goal).length / ds.length : 0 }
  })

  const [start] = dayBounds(firstDay > from ? firstDay : from)
  const [, end] = dayBounds(today)
  const hourRows = await db.execute<{ h: number; total: number }>(sql`
    select extract(hour from logged_at at time zone ${TZ})::int as h, sum(effective_ml)::int as total
    from water_logs where user_id = ${userId} and deleted_at is null and logged_at >= ${start.toISOString()} and logged_at < ${end.toISOString()}
    group by 1`)
  const nDays = Math.max(1, cur.length)
  const hourlyAvg = Array(24).fill(0)
  for (const r of hourRows) hourlyAvg[Number(r.h)] = Math.round(Number(r.total) / nDays)

  const [[profile]] = await Promise.all([
    db.select({ wake: schema.profiles.wakeTime, sleep: schema.profiles.sleepTime }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
  ])
  const wakeH = Math.ceil(parseHm(profile?.wake, 450) / 60)
  const sleepMin = parseHm(profile?.sleep, 1410)
  const sleepH = Math.min(23, Math.floor((sleepMin <= wakeH * 60 ? 1439 : sleepMin) / 60) - 1)
  let weakest: WaterStats['weakest'] = null
  if (withLogs.length >= 3) {
    for (let h = wakeH; h + 3 <= sleepH; h++) {
      const s = hourlyAvg[h] + hourlyAvg[h + 1] + hourlyAvg[h + 2]
      if (!weakest || s < weakest.avg) weakest = { from: h * 60, to: (h + 3) * 60, avg: s }
    }
  }

  const sFrom = addDays(today, -119)
  // seri, Su ve Bugün ekranlarıyla aynı hedefle (antrenman eki dahil) hesaplanır
  const [sTotals, sBonus2] = await Promise.all([dailyTotals(userId, sFrom, today), waterBonusByDay(userId, sFrom, today)])
  const sDays = Array.from({ length: 120 }, (_, i) => { const d = addDays(sFrom, i); return { day: d, total: sTotals.get(d)?.total ?? 0, goal: goalForDay(history, d) + (sBonus2.get(d) ?? 0) } })
  const fa = sDays.findIndex((d) => d.total > 0)

  return {
    range, days: cur, avg, prevAvg, metRate, best, worst,
    totalMl: cur.reduce((a, d) => a + d.total, 0),
    avgCount: withLogs.length ? Math.round((withLogs.reduce((a, d) => a + d.count, 0) / withLogs.length) * 10) / 10 : 0,
    weekdayRate, hourlyAvg, weakest,
    streak: computeStreak(fa >= 0 ? sDays.slice(fa) : sDays.slice(-1)),
    activeDays: withLogs.length,
  }
}

// ───────── Analiz, rozetler, aylık rapor (Faz 1b) ─────────

/** Gün bazında toplam, kayıt sayısı ve ilk kayıt dakikası. */
export async function dailyDetail(userId: string, from: string, to: string) {
  const [start] = dayBounds(from)
  const [, end] = dayBounds(to)
  const rows = await db.execute<{ day: string; total: number; count: number; first: number }>(sql`
    select ${sqlDay(sql`logged_at`)} as day, sum(effective_ml)::int as total, count(*)::int as count,
      min(extract(hour from logged_at at time zone ${TZ}) * 60 + extract(minute from logged_at at time zone ${TZ}))::int as first
    from water_logs where user_id = ${userId} and deleted_at is null and logged_at >= ${start.toISOString()} and logged_at < ${end.toISOString()}
    group by 1`)
  return new Map(rows.map((r) => [r.day, { total: Number(r.total), count: Number(r.count), first: Number(r.first) }]))
}

export async function getWaterInsights(userId: string) {
  const { waterInsights, computeBadges } = await import('./water-insights')
  const { reminderStats } = await import('./scheduler')
  const today = dayString()
  const history = await goalHistory(userId)
  const from = addDays(today, -364)
  const [detail, iBonus] = await Promise.all([dailyDetail(userId, from, today), waterBonusByDay(userId, from, today)])
  const all = Array.from({ length: 365 }, (_, i) => {
    const d = addDays(from, i)
    const x = detail.get(d)
    return { day: d, total: x?.total ?? 0, count: x?.count ?? 0, firstAt: x ? x.first : null, goal: goalForDay(history, d) + (iBonus.get(d) ?? 0) }
  })
  const firstIdx = all.findIndex((d) => d.count > 0)
  const active = firstIdx >= 0 ? all.slice(firstIdx) : all.slice(-1)

  const [[profile]] = await Promise.all([
    db.select({ wake: schema.profiles.wakeTime, sleep: schema.profiles.sleepTime }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
  ])
  const wake = parseHm(profile?.wake, 450), sleep = parseHm(profile?.sleep, 1410)
  const [hStart] = dayBounds(addDays(today, -14))
  const [tStart] = dayBounds(today)
  const hourRows = await db.execute<{ h: number; total: number }>(sql`
    select extract(hour from logged_at at time zone ${TZ})::int as h, sum(effective_ml)::int as total from water_logs
    where user_id = ${userId} and deleted_at is null and logged_at >= ${hStart.toISOString()} and logged_at < ${tStart.toISOString()} group by 1`)
  const hourlyAvg14 = Array(24).fill(0)
  for (const r of hourRows) hourlyAvg14[Number(r.h)] = Math.round(Number(r.total) / 14)

  const insights = waterInsights({ days: all.slice(-29), hourlyAvg14, wake, sleep, reminders: await reminderStats(userId) })
  const badges = computeBadges(active, wake)

  // Son 6 ay
  const months: { month: string; avg: number; rate: number; active: number }[] = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k)
    const m = d.toISOString().slice(0, 7)
    const ds = active.filter((x) => x.day.startsWith(m) && (x.day < today || x.count > 0))
    const act = ds.filter((x) => x.count > 0)
    months.push({ month: m, avg: act.length ? Math.round(act.reduce((a, x) => a + x.total, 0) / act.length) : 0, rate: ds.length ? ds.filter((x) => x.total >= x.goal).length / ds.length : 0, active: act.length })
  }
  return { insights, badges, months }
}
