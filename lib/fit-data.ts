import 'server-only'
import { carbCycleDay } from './scenario'
import crypto from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString, diffDays } from './time'
import { calorieFloor, type Sex } from './calc'
import { balanceWindow, checkinCompute, closureDiff, dayBaseKcal, distributeDiff, exceptionDays, planAdvice, planBank, scaleMacros, targetKcal, trainingWeekdays, trendSeries, type PlanDay } from './fit'
import { dayMacros } from './food-data'
import { publish } from './events'
import { minuteOfDay } from './water-data'
import { dayBurned } from './burn'
import { gainQuality, gainRatePctMonth, type Experience } from './body-comp'

type Goal = typeof schema.goals.$inferSelect

export async function activeGoal(userId: string): Promise<Goal | null> {
  const [g] = await db.select().from(schema.goals).where(and(eq(schema.goals.userId, userId), eq(schema.goals.active, true))).orderBy(desc(schema.goals.createdAt)).limit(1)
  return g ?? null
}

export async function sexOf(userId: string): Promise<Sex> {
  const [p] = await db.select({ sex: schema.profiles.sex }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  return (p?.sex as Sex) ?? 'female'
}

export interface DayTarget {
  day: string
  base: number
  adjustment: number
  kcal: number
  protein: number
  carb: number
  fat: number
  closed: boolean
  reasons: { kcal: number; reason: string; sourceDay: string | null }[]
}

async function adjustmentsBetween(userId: string, from: string, to: string) {
  return db.select().from(schema.kcalAdjustments)
    .where(and(eq(schema.kcalAdjustments.userId, userId), gte(schema.kcalAdjustments.day, from), lte(schema.kcalAdjustments.day, to), isNull(schema.kcalAdjustments.deletedAt)))
    .orderBy(asc(schema.kcalAdjustments.day), asc(schema.kcalAdjustments.id))
}

/** Günlerin hedefi: kapanmış günler anlık görüntüden, açık günler plan tabanı + düzeltmelerden. */
export async function dayTargets(userId: string, from: string, to: string, goal?: Goal | null): Promise<DayTarget[]> {
  const g = goal === undefined ? await activeGoal(userId) : goal
  const baseMacros = { kcal: g?.dailyKcal ?? 2000, protein: g?.proteinG ?? 120, carb: g?.carbG ?? 200, fat: g?.fatG ?? 65 }
  const [adj, closed, [prof]] = await Promise.all([
    adjustmentsBetween(userId, from, to),
    db.select().from(schema.dailyTargets).where(and(eq(schema.dailyTargets.userId, userId), gte(schema.dailyTargets.day, from), lte(schema.dailyTargets.day, to))),
    db.select({ sex: schema.profiles.sex, trainingDays: schema.profiles.trainingDays }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
  ])
  const floor = calorieFloor((prof?.sex as Sex) ?? 'female')
  const closedBy = new Map(closed.map((c) => [c.day, c]))
  // Karb döngüsü (Faz 4c): açık günlerde antrenman/dinlenme gününe göre karbonhidrat kaydırılır (haftalık toplam korunur)
  const [cc] = await db.select().from(schema.carbCycle).where(eq(schema.carbCycle.userId, userId)).limit(1)
  const cyc = cc?.enabled && cc.weekdays.length ? cc : null
  // Faz 8: koruyup kas kazanmada antrenman günü fazla / dinlenme günü az kalori (karb döngüsü günleri seçiliyse onlar)
  const recompDays = g?.type === 'recomp' ? trainingWeekdays(prof?.trainingDays, cc?.enabled ? cc.weekdays : null) : null
  const baseFor = (d: string) => {
    if (recompDays) return scaleMacros(baseMacros, dayBaseKcal('recomp', baseMacros.kcal, new Date(d + 'T12:00:00Z').getUTCDay(), recompDays, floor))
    if (!cyc) return baseMacros
    const { carbDelta: _, ...m } = carbCycleDay(baseMacros, cyc.weekdays.includes(new Date(d + 'T12:00:00Z').getUTCDay()), cyc.weekdays.length, cyc.shiftG)
    return m
  }
  const out: DayTarget[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = adj.filter((a) => a.day === d)
    const c = closedBy.get(d)
    if (c?.closedAt) {
      const kcal = c.baseKcal + c.adjustmentKcal
      out.push({ day: d, base: c.baseKcal, adjustment: c.adjustmentKcal, kcal, protein: c.proteinG, carb: c.carbG, fat: c.fatG, closed: true, reasons: list.map((a) => ({ kcal: a.kcal, reason: a.reason, sourceDay: a.sourceDay })) })
      continue
    }
    const bm = baseFor(d)
    // etkin düzeltme: taban + düzeltme güvenli tabanın altına inmez (check-in tabanı sonradan düşürmüş olabilir)
    const adjustment = targetKcal(bm.kcal, list.reduce((a, x) => a + x.kcal, 0), floor) - bm.kcal
    const m = scaleMacros(bm, bm.kcal + adjustment)
    out.push({ day: d, base: bm.kcal, adjustment, ...m, closed: false, reasons: list.map((a) => ({ kcal: a.kcal, reason: a.reason, sourceDay: a.sourceDay })) })
  }
  return out
}

export async function dayTarget(userId: string, day: string, goal?: Goal | null): Promise<DayTarget> {
  return (await dayTargets(userId, day, day, goal))[0]
}

/**
 * Bir günü kapatır: farkı hesaplar, sonraki açık günlere dağıtır, anlık görüntüyü yazar.
 * Önce satır atomik olarak "kapatıldı" diye işaretlenir; aynı anda gelen ikinci çağrı (zamanlayıcı + düğme) hiçbir şey yapmaz.
 */
export async function closeDay(userId: string, day: string): Promise<{ kind: string; diff: number; leftover: number } | null> {
  const goal = await activeGoal(userId)
  if (!goal || day < goal.startDate || day > dayString()) return null
  const t = await dayTarget(userId, day, goal)
  if (t.closed) return null
  const eaten = await dayMacros(userId, day)
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from meal_items where user_id = ${userId} and day = ${day} and deleted_at is null and meal <> 'supplement'`)
  const burned = await dayBurned(userId, day) // antrenman + kardiyo net kalorisi (Faz 3a)
  const c0 = closureDiff({ eaten: eaten.kcal, target: t.kcal, burned, items: Number(n) })
  // Ö5b: tatil / hastalık modunda dengeleme durur (fark sonraki günlere dağıtılmaz)
  const { balancePausedOn } = await import('./modes-data')
  const c = c0.diff !== 0 && (await balancePausedOn(userId, day)) ? { ...c0, kind: 'paused' as const, diff: 0 } : c0
  const row = {
    userId, day, baseKcal: t.base, adjustmentKcal: t.adjustment, proteinG: t.protein, carbG: t.carb, fatG: t.fat, waterMl: goal.waterMl,
    closedAt: new Date(), eatenKcal: eaten.kcal, burnedKcal: burned, items: Number(n), closureKind: c.kind, diffKcal: c.diff, leftoverKcal: 0,
  }
  const claimed = await db.insert(schema.dailyTargets).values(row)
    .onConflictDoUpdate({ target: [schema.dailyTargets.userId, schema.dailyTargets.day], set: row, setWhere: isNull(schema.dailyTargets.closedAt) })
    .returning({ day: schema.dailyTargets.day })
  if (!claimed.length) return null
  let leftover = 0
  if (c.diff !== 0) {
    const win = balanceWindow(day, dayString(), goal.endDate) // geçmişe dağıtılmaz
    const upcoming = win ? (await dayTargets(userId, win.first, win.last, goal)).filter((u) => !u.closed) : []
    if (upcoming.length) {
      // banka harcama günleri (düğün, tatil…) dengelemeden korunur: kullanıcının o gün için ayırdığı kalori kesilmez
      const event = new Set((await db.select({ day: schema.kcalAdjustments.day }).from(schema.kcalAdjustments).where(and(eq(schema.kcalAdjustments.userId, userId), eq(schema.kcalAdjustments.reason, 'bank-spend'), gte(schema.kcalAdjustments.day, win!.first), sql`${schema.kcalAdjustments.deletedAt} is null`))).map((r) => r.day))
      const plan: PlanDay[] = upcoming.map((u) => ({ day: u.day, base: u.base, current: u.adjustment, protected: event.has(u.day) }))
      const r = distributeDiff(c.diff, plan, calorieFloor(await sexOf(userId)))
      leftover = r.leftover
      if (r.adjustments.length) await db.insert(schema.kcalAdjustments).values(r.adjustments.map((a) => ({ userId, day: a.day, kcal: a.kcal, reason: 'balance', sourceDay: day })))
    } else leftover = c.diff
    if (leftover) await db.update(schema.dailyTargets).set({ leftoverKcal: leftover }).where(and(eq(schema.dailyTargets.userId, userId), eq(schema.dailyTargets.day, day)))
  }
  await publish(userId, 'day.closed', { day, kind: c.kind, diff: c.diff, raw: c.raw, leftover })
  return { kind: c.kind, diff: c.diff, leftover }
}

/** Kapanmış günü yeniden açar: o günden açık günlere giden dengeleme düzeltmeleri silinir. */
export async function reopenDay(userId: string, day: string): Promise<boolean> {
  const res = await db.update(schema.dailyTargets).set({ closedAt: null, closureKind: null, diffKcal: null, leftoverKcal: null })
    .where(and(eq(schema.dailyTargets.userId, userId), eq(schema.dailyTargets.day, day), sql`${schema.dailyTargets.closedAt} is not null`)).returning({ day: schema.dailyTargets.day })
  if (!res.length) return false
  const closedLater = db.select({ d: schema.dailyTargets.day }).from(schema.dailyTargets).where(and(eq(schema.dailyTargets.userId, userId), sql`${schema.dailyTargets.closedAt} is not null`))
  await db.update(schema.kcalAdjustments).set({ deletedAt: new Date() }).where(and(
    eq(schema.kcalAdjustments.userId, userId), eq(schema.kcalAdjustments.sourceDay, day), eq(schema.kcalAdjustments.reason, 'balance'),
    isNull(schema.kcalAdjustments.deletedAt), sql`${schema.kcalAdjustments.day} not in (${closedLater})`,
  ))
  return true
}

/** Kapanmış bir günün kaydı değişti: yeniden açıp (geçmiş günse) yeniden kapatır. */
export async function refreshClosedDay(userId: string, day: string): Promise<void> {
  if (!(await reopenDay(userId, day))) return
  if (day < dayString()) await closeDay(userId, day)
}

/** Kapanmamış geçmiş günleri (en fazla 7) sırayla kapatır. Gece 03.00'ten önce dün açık kalır. */
export async function closePendingDays(userId: string, now = new Date()): Promise<number> {
  const goal = await activeGoal(userId)
  if (!goal) return 0
  const today = dayString(now)
  const lastClosable = minuteOfDay(now) >= 180 ? addDays(today, -1) : addDays(today, -2)
  const from = addDays(today, -7) > goal.startDate ? addDays(today, -7) : goal.startDate
  if (lastClosable < from) return 0
  const closed = await db.select({ day: schema.dailyTargets.day }).from(schema.dailyTargets)
    .where(and(eq(schema.dailyTargets.userId, userId), gte(schema.dailyTargets.day, from), lte(schema.dailyTargets.day, lastClosable), sql`${schema.dailyTargets.closedAt} is not null`))
  const done = new Set(closed.map((c) => c.day))
  let n = 0
  for (let d = from; d <= lastClosable; d = addDays(d, 1)) if (!done.has(d)) { await closeDay(userId, d); n++ }
  return n
}

/** "İstisna say": o günden gelen gelecekteki dengeleme düzeltmeleri kaldırılır, hedef tarih en fazla 3 gün uzar. */
export async function makeException(userId: string, sourceDay: string): Promise<{ removed: number; daysAdded: number }> {
  const goal = await activeGoal(userId)
  if (!goal) return { removed: 0, daysAdded: 0 }
  const today = dayString()
  const rows = await db.select().from(schema.kcalAdjustments).where(and(eq(schema.kcalAdjustments.userId, userId), eq(schema.kcalAdjustments.sourceDay, sourceDay), eq(schema.kcalAdjustments.reason, 'balance'), gte(schema.kcalAdjustments.day, today), isNull(schema.kcalAdjustments.deletedAt), sql`${schema.kcalAdjustments.kcal} < 0`))
  if (!rows.length) return { removed: 0, daysAdded: 0 }
  const removedKcal = -rows.reduce((a, r) => a + r.kcal, 0) // fazla yeme düzeltmeleri negatiftir
  await db.update(schema.kcalAdjustments).set({ deletedAt: new Date() }).where(inArray(schema.kcalAdjustments.id, rows.map((r) => r.id)))
  const deficit = Math.max(0, goal.tdee - goal.dailyKcal)
  const daysAdded = goal.type === 'lose' ? exceptionDays(removedKcal, deficit) : 0
  if (daysAdded) await db.update(schema.goals).set({ endDate: addDays(goal.endDate, daysAdded) }).where(eq(schema.goals.id, goal.id))
  await db.update(schema.dailyTargets).set({ closureKind: 'exception' }).where(and(eq(schema.dailyTargets.userId, userId), eq(schema.dailyTargets.day, sourceDay)))
  await publish(userId, 'plan.adjusted', { kind: 'exception', sourceDay, removedKcal, daysAdded })
  return { removed: rows.length, daysAdded }
}

export async function createBank(userId: string, eventDay: string, extra: number, note: string | null) {
  const goal = await activeGoal(userId)
  if (!goal) return { error: 'Aktif plan yok' }
  const today = dayString()
  if (eventDay > addDays(today, 14)) return { error: 'Etkinlik en fazla 14 gün sonrası için planlanabilir' }
  if (eventDay > goal.endDate) return { error: 'Etkinlik hedef tarihinden sonra' }
  const days = await dayTargets(userId, addDays(today, 1), eventDay, goal)
  const r = planBank({ today, eventDay, extra, days: days.map((d) => ({ day: d.day, base: d.base, current: d.adjustment })), floor: calorieFloor(await sexOf(userId)) })
  if ('error' in r) return r
  const bankId = crypto.randomUUID()
  await db.insert(schema.kcalAdjustments).values(r.adjustments.map((a) => ({ userId, day: a.day, kcal: a.kcal, reason: a.day === eventDay ? 'bank-spend' : 'bank-save', bankId, note })))
  await publish(userId, 'plan.adjusted', { kind: 'bank', eventDay, extra, perDay: r.perDay })
  return { ok: true as const, perDay: r.perDay, days: r.adjustments.length - 1 }
}

export async function cancelBank(userId: string, bankId: string) {
  const today = dayString()
  await db.update(schema.kcalAdjustments).set({ deletedAt: new Date() }).where(and(eq(schema.kcalAdjustments.userId, userId), eq(schema.kcalAdjustments.bankId, bankId), gte(schema.kcalAdjustments.day, today), isNull(schema.kcalAdjustments.deletedAt)))
}

export async function upcomingBanks(userId: string) {
  const today = dayString()
  const rows = await db.select().from(schema.kcalAdjustments).where(and(eq(schema.kcalAdjustments.userId, userId), eq(schema.kcalAdjustments.reason, 'bank-spend'), gte(schema.kcalAdjustments.day, today), isNull(schema.kcalAdjustments.deletedAt))).orderBy(asc(schema.kcalAdjustments.day))
  return rows.map((r) => ({ bankId: r.bankId!, day: r.day, extra: r.kcal, note: r.note }))
}

/** Gün başına son tartı + üssel trend (α=0.15), tartı olmayan günler trendi taşır. */
export async function weightSeries(userId: string, from: string, to: string) {
  const logs = await db.select({ at: schema.weightLogs.loggedAt, kg: schema.weightLogs.kg }).from(schema.weightLogs)
    .where(and(eq(schema.weightLogs.userId, userId), isNull(schema.weightLogs.deletedAt))).orderBy(asc(schema.weightLogs.loggedAt))
  const byDay = new Map<string, number>()
  for (const l of logs) byDay.set(dayString(l.at), l.kg)
  return trendSeries(byDay, from, to)
}

export async function checkinData(userId: string) {
  const goal = await activeGoal(userId)
  if (!goal) return null
  const today = dayString()
  const from = addDays(today, -28) > goal.startDate ? addDays(today, -28) : goal.startDate
  const [series, closed, sex, lastEvt] = await Promise.all([
    weightSeries(userId, from, today),
    db.select().from(schema.dailyTargets).where(and(eq(schema.dailyTargets.userId, userId), gte(schema.dailyTargets.day, from), sql`${schema.dailyTargets.closedAt} is not null`)),
    sexOf(userId),
    db.select().from(schema.events).where(and(eq(schema.events.userId, userId), eq(schema.events.type, 'plan.adjusted'), sql`${schema.events.payload}->>'kind' = 'checkin'`)).orderBy(desc(schema.events.createdAt)).limit(1),
  ])
  const intakeBy = new Map(closed.filter((c) => ['balanced', 'over', 'under', 'exception', 'paused'].includes(c.closureKind ?? '')).map((c) => [c.day, c.eatenKcal ?? null]))
  // check-in sayacı aktif plana göre: yeni hedef/aşama başlayınca eski planın check-in'i sayılmaz
  const lastCheckin = lastEvt[0] && dayString(lastEvt[0].createdAt) > goal.startDate ? dayString(lastEvt[0].createdAt) : goal.startDate
  const { tdee, smoothTdee, trendNow, forecast, due, proposal } = checkinCompute({ goal: { ...goal, type: goal.type as 'lose' }, series, intakeBy, today, lastCheckin, floor: calorieFloor(sex) })
  return { goal, tdee, smoothTdee, trendNow, forecast, due, lastCheckin, proposal }
}

export async function applyCheckin(userId: string) {
  const d = await checkinData(userId)
  if (!d?.proposal || !d.tdee.tdee) return { error: 'Check-in için yeterli veri yok (en az 14 gün, 10 tam kayıtlı gün)' }
  if (!d.due) return { error: 'Bu haftanın check-in\'i zaten yapıldı' }
  const m = scaleMacros({ kcal: d.goal.dailyKcal, protein: d.goal.proteinG, carb: d.goal.carbG, fat: d.goal.fatG }, d.proposal.kcal)
  // iyimser kilit: iki sekme / çift dokunuş aynı öneriyi iki kez uygulamasın
  const upd = await db.update(schema.goals).set({ dailyKcal: m.kcal, carbG: m.carb, fatG: m.fat, tdee: d.smoothTdee ?? d.tdee.tdee })
    .where(and(eq(schema.goals.id, d.goal.id), eq(schema.goals.dailyKcal, d.goal.dailyKcal), eq(schema.goals.tdee, d.goal.tdee))).returning({ id: schema.goals.id })
  if (!upd.length) return { error: 'Plan bu arada değişti; sayfayı yenileyip tekrar dene' }
  await publish(userId, 'plan.adjusted', { kind: 'checkin', from: d.goal.dailyKcal, to: m.kcal, measuredTdee: d.tdee.tdee, confidence: d.tdee.confidence })
  return { ok: true as const, kcal: m.kcal, delta: d.proposal.delta }
}

/** /fit ekranı için tüm veriler. Açılışta kapanmamış geçmiş günler toparlanır. */
export async function getFitScreen(userId: string) {
  await closePendingDays(userId)
  const goal = await activeGoal(userId)
  if (!goal) return null
  const today = dayString()
  const [targets, closedRows, series, banks, checkin] = await Promise.all([
    dayTargets(userId, today, addDays(today, 6), goal),
    db.select().from(schema.dailyTargets).where(and(eq(schema.dailyTargets.userId, userId), gte(schema.dailyTargets.day, addDays(today, -7)), sql`${schema.dailyTargets.closedAt} is not null`)).orderBy(desc(schema.dailyTargets.day)),
    weightSeries(userId, goal.startDate, today),
    upcomingBanks(userId),
    checkinData(userId),
  ])
  const eatenToday = await dayMacros(userId, today)
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from meal_items where user_id = ${userId} and day = ${today} and deleted_at is null and meal <> 'supplement'`)
  // istisna sayılabilecek son fazla gün: kaynağı o gün olan, bugün ve sonrasında duran negatif düzeltme varsa
  const pendingFrom = await db.execute<{ day: string; kcal: number }>(sql`
    select source_day::text as day, sum(kcal)::int as kcal from kcal_adjustments
    where user_id = ${userId} and reason = 'balance' and deleted_at is null and day >= ${today} and source_day is not null
    group by source_day order by source_day desc`)
  const remaining = new Map(pendingFrom.map((r) => [String(r.day), Number(r.kcal)]))
  const sex = await sexOf(userId)
  const quality = await qualityCard(userId, goal, checkin?.forecast.kgPerWeek ?? null, checkin?.trendNow ?? goal.startWeightKg).catch(() => null)
  return {
    today, goal, targets, series, banks, checkin, floor: calorieFloor(sex), quality,
    todayState: { eaten: eatenToday.kcal, items: Number(n), closed: targets[0].closed, closure: closedRows.find((c) => c.day === today) ?? null },
    closures: closedRows.filter((c) => c.day < today).map((c) => ({
      day: c.day, kind: c.closureKind ?? 'untracked', eaten: c.eatenKcal ?? 0, target: c.baseKcal + c.adjustmentKcal + (c.burnedKcal ?? 0), // kapanıştaki bütçe (antrenman kredisi dahil; closureDiff ile aynı)
      diff: c.diffKcal ?? 0, leftover: c.leftoverKcal ?? 0, remaining: remaining.get(c.day) ?? 0,
    })),
  }
}

/** Faz 8: kazanım kalitesi için ölçümler — 4 haftalık bel değişimi ve ana hareketlerde e1RM değişimi (%). */
async function qualityInputs(userId: string): Promise<{ waistDeltaCm: number | null; strengthDeltaPct: number | null }> {
  const today = dayString()
  const ms = await db.select({ day: schema.bodyMeasurements.day, waist: schema.bodyMeasurements.waistCm }).from(schema.bodyMeasurements)
    .where(and(eq(schema.bodyMeasurements.userId, userId), gte(schema.bodyMeasurements.day, addDays(today, -42)), isNull(schema.bodyMeasurements.deletedAt), sql`${schema.bodyMeasurements.waistCm} is not null`))
    .orderBy(asc(schema.bodyMeasurements.day))
  const waistDeltaCm = ms.length >= 2 && diffDays(ms[0].day, ms.at(-1)!.day) >= 14 ? Math.round((ms.at(-1)!.waist! - ms[0].waist!) * 10) / 10 : null
  const rows = await db.execute<{ ex: number; recent: number | null; prior: number | null }>(sql`
    select exercise_id as ex,
      max(case when w.day >= ${addDays(today, -14)} then s.kg * (1 + s.reps / 30.0) end) as recent,
      max(case when w.day < ${addDays(today, -14)} and w.day >= ${addDays(today, -42)} then s.kg * (1 + s.reps / 30.0) end) as prior
    from workout_sets s join workouts w on w.id = s.workout_id
    where s.user_id = ${userId} and w.deleted_at is null and s.type = 'normal' and s.kg > 0 and s.reps between 1 and 15 and w.day >= ${addDays(today, -42)}
    group by exercise_id`)
  const pairs = rows.filter((r) => r.recent && r.prior).map((r) => (Number(r.recent) / Number(r.prior) - 1) * 100)
  const strengthDeltaPct = pairs.length >= 2 ? Math.round((pairs.reduce((a, b) => a + b, 0) / pairs.length) * 10) / 10 : null
  return { waistDeltaCm, strengthDeltaPct }
}

export async function qualityCard(userId: string, goal: Goal, weeklyKg: number | null, weightKg: number) {
  const [p] = await db.select({ sex: schema.profiles.sex, exp: schema.profiles.experience, bf: schema.profiles.bodyFatPct }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const q = await qualityInputs(userId)
  const rate = gainRatePctMonth((p?.exp ?? 'new') as Experience, (p?.sex as Sex) ?? 'male', p?.bf ?? null)
  return { ...gainQuality({ goal: goal.type as 'lose' | 'gain' | 'recomp', weightKg, weeklyKg, rate, ...q }), ...q }
}

/** Faz 7-2: check-in ekranı için haftalık plan önerileri (kardiyo, antrenman sayısı). */
export async function weeklyAdvice(userId: string, goal: Goal, weeklyKg: number | null): Promise<string[]> {
  const today = dayString()
  const from = addDays(today, -6)
  const [[c], [w], [p]] = await Promise.all([
    db.select({ min: sql<number>`coalesce(sum(minutes),0)` }).from(schema.cardioSessions).where(and(eq(schema.cardioSessions.userId, userId), isNull(schema.cardioSessions.deletedAt), gte(schema.cardioSessions.day, from))),
    db.select({ n: sql<number>`count(distinct day)::int` }).from(schema.workouts).where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt), gte(schema.workouts.day, from))),
    db.select({ sex: schema.profiles.sex, td: schema.profiles.trainingDays }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
  ])
  return planAdvice({
    goal: goal.type as 'lose' | 'gain' | 'recomp', weeklyKg, plannedWeeklyKg: Math.abs(goal.tdee - goal.dailyKcal) * 7 / 7700,
    atFloor: goal.dailyKcal <= calorieFloor((p?.sex as Sex) ?? 'female') + 10, cardioMinWeek: Number(c?.min ?? 0), workoutsWeek: Number(w?.n ?? 0), targetTrainDays: p?.td ?? null,
  })
}
