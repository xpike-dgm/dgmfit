import 'server-only'
import { goalStatus } from './goal-phase'
import { recoveryFor } from './fitness-data'
import { qualityCard, weeklyAdvice } from './fit-data'
import { estimateBodyFat, leanMass } from './body-comp'
// AI koç veri katmanı (Faz 4b): bağlam toplama, sohbet, onaylı eylemler, günlük içgörü, haftalık rapor.
// Kural: tüm sayılar motorlardan (fit, weekly, safety, insights, coach-calc); dil modeli yalnızca yorumlar.
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, atTime, currentDayStart, dayString, diffDays, inLateWindow } from './time'
import { ageFromBirthDate, calorieFloor, computePlan, fmtNum, type Activity, type GoalType, type Sex } from './calc'
import { activeGoal, checkinData, dayTargets, sexOf, weightSeries } from './fit-data'
import { dailyTotals, goalHistory, minuteOfDay, getWaterInsights } from './water-data'
import { goalForDay } from './water'
import { waterBonusByDay } from './burn'
import { searchFoods } from './food-data'
import { macrosFor } from './food'
import type { Nutrients } from './nutrition'
import { getProgram, listPrograms, searchExercises, addExerciseToDay, updateProgramExercise } from './fitness-data'
import { weekStats, ruleSuggestions, numbersAllowed, dow, WEEKDAY, type DayFacts, type WeekStats } from './weekly'
import { safetyFlags, riskyText, SUPPORT, type SafetyResult } from './safety'
import { insightCandidates, pickInsight, type InsightFact } from './insights'
import { dayLine, matchProgramDay, shiftGoal, whatIfImpact, type WhatIf } from './coach-calc'
import { aiAvailable, AiError, runTask } from './ai/engine'
import { PERSONAS, type CoachAction, type Persona } from './ai/schemas'
import { publish } from './events'
import { createMenu } from './planner-data'
import { runLookups } from './coach-tools'
import { suggestMeals, type MealSuggestion } from './meal-builder-data'
import { parseLimits } from './meal-builder'

const HISTORY = 16 // modele giden önceki mesaj sayısı (G2: 10 → 16; takip soruları önceki konuyu kaybetmesin)

export async function coachPrefs(userId: string) {
  const [r] = await db.select().from(schema.coachPrefs).where(eq(schema.coachPrefs.userId, userId)).limit(1)
  return r ?? { userId, persona: 'supportive', insights: true, weeklyPush: true, mealReminders: true, nudges: false, updatedAt: new Date() }
}
export async function saveCoachPrefs(userId: string, v: { persona: Persona; insights: boolean; weeklyPush: boolean; nudges?: boolean }) {
  await db.insert(schema.coachPrefs).values({ userId, ...v }).onConflictDoUpdate({ target: schema.coachPrefs.userId, set: { ...v, updatedAt: new Date() } })
}

/** Gün aralığı için tüm modüllerden günlük özet. */
export async function gatherDays(userId: string, from: string, to: string): Promise<DayFacts[]> {
  if (from > to) return []
  const goal = await activeGoal(userId)
  const [targets, meals, wk, cardio, wTotals, wHist, wBonus] = await Promise.all([
    dayTargets(userId, from, to, goal),
    db.execute<{ day: string; kcal: number; protein: number; carb: number; fat: number; n: number }>(sql`select day::text as day, coalesce(sum(kcal),0)::float as kcal, coalesce(sum(protein),0)::float as protein, coalesce(sum(carb),0)::float as carb, coalesce(sum(fat),0)::float as fat, count(*)::int as n from meal_items where user_id = ${userId} and day between ${from} and ${to} and deleted_at is null group by day`),
    db.execute<{ day: string; n: number; vol: number; kcal: number }>(sql`select day::text as day, count(*)::int as n, coalesce(sum(volume_kg),0)::float as vol, coalesce(sum(kcal_net),0)::int as kcal from workouts where user_id = ${userId} and day between ${from} and ${to} and deleted_at is null group by day`),
    db.execute<{ day: string; min: number; kcal: number }>(sql`select day::text as day, coalesce(sum(minutes),0)::float as min, coalesce(sum(kcal_net),0)::int as kcal from cardio_sessions where user_id = ${userId} and day between ${from} and ${to} and deleted_at is null group by day`),
    dailyTotals(userId, from, to), goalHistory(userId), waterBonusByDay(userId, from, to),
  ])
  const m = new Map(meals.map((r) => [String(r.day), r])), w = new Map(wk.map((r) => [String(r.day), r])), c = new Map(cardio.map((r) => [String(r.day), r]))
  return targets.map((t) => {
    const mm = m.get(t.day), ww = w.get(t.day), cc = c.get(t.day)
    return {
      day: t.day, target: t.kcal, eaten: Math.round(Number(mm?.kcal ?? 0)), items: Number(mm?.n ?? 0), protein: Math.round(Number(mm?.protein ?? 0)), proteinTarget: t.protein,
      carb: Math.round(Number(mm?.carb ?? 0)), carbTarget: t.carb, fat: Math.round(Number(mm?.fat ?? 0)), fatTarget: t.fat,
      burned: Number(ww?.kcal ?? 0) + Number(cc?.kcal ?? 0), waterMl: wTotals.get(t.day)?.total ?? 0,
      waterGoal: (wHist.length ? goalForDay(wHist, t.day) : goal?.waterMl ?? 2500) + (wBonus.get(t.day) ?? 0),
      workouts: Number(ww?.n ?? 0), cardioMin: Math.round(Number(cc?.min ?? 0)), volumeKg: Math.round(Number(ww?.vol ?? 0)),
    }
  })
}

const GOAL_LABEL: Record<string, string> = { lose: 'kilo vermek', gain: 'kilo almak', recomp: 'vücut kompozisyonu (yağ yak, kas koru)' }
const SEX_LABEL: Record<string, string> = { female: 'kadın', male: 'erkek' }
const ACT_LABEL: Record<string, string> = { sedentary: 'hareketsiz', light: 'hafif aktif', moderate: 'orta aktif', active: 'aktif', very_active: 'çok aktif' }
const EXP_LABEL: Record<string, string> = { new: 'yeni başlayan', mid: 'orta', adv: 'ileri' }
const kg = (n: number) => fmtNum(n, 1)
const signed = (n: number, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n), d)

export interface CoachContext {
  text: string
  today: string
  goal: Awaited<ReturnType<typeof activeGoal>>
  sex: Sex
  floor: number
  safety: SafetyResult
  programDays: { id: string; name: string; programName: string }[]
  todayFacts: DayFacts
  week: WeekStats
}

/** Koç için özet bağlam: motorların hesapladığı sayılar, kısa Türkçe metin. */
export async function coachContext(userId: string): Promise<CoachContext> {
  const today = dayString(), now = new Date()
  const [[profile], goal, sex] = await Promise.all([db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1), activeGoal(userId), sexOf(userId)])
  const floor = calorieFloor(sex)
  const [days, series, checkin, prs, programs] = await Promise.all([
    gatherDays(userId, addDays(today, -7), today),
    weightSeries(userId, addDays(today, -28), today),
    checkinData(userId).catch(() => null),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.personalRecords).where(and(eq(schema.personalRecords.userId, userId), gte(schema.personalRecords.createdAt, new Date(Date.now() - 7 * 86400000)))),
    listPrograms(userId),
  ])
  const todayFacts = days.at(-1)!
  const past = days.slice(0, -1)
  const safety = safetyFlags(past, floor)
  const week = weekStats(past, series.filter((s) => s.raw !== null).map((s) => ({ day: s.day, kg: s.raw! })), Number(prs[0]?.n ?? 0))
  const trendPts = series.filter((s) => s.trend !== null)
  const trendNow = trendPts.at(-1)?.trend ?? null
  const trend14 = trendPts.filter((s) => s.day <= addDays(today, -14)).at(-1)?.trend ?? null
  const lastWeigh = series.filter((s) => s.raw !== null).at(-1)
  const active = programs.find((p) => p.active)
  const program = active ? await getProgram(userId, active.id) : null
  const hm = minuteOfDay(now)

  const L: string[] = []
  L.push(`BAĞLAM (bugün ${today} ${WEEKDAY[dow(today)]}, saat ${String(Math.floor(hm / 60)).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')})`)
  if (profile) L.push(`Profil: ${SEX_LABEL[profile.sex] ?? profile.sex}, ${ageFromBirthDate(profile.birthDate)} yaş, ${fmtNum(profile.heightCm)} cm; aktivite ${ACT_LABEL[profile.activity] ?? profile.activity}${profile.experience ? `; antrenman deneyimi ${EXP_LABEL[profile.experience] ?? profile.experience}` : ''}${profile.dietPref ? `; beslenme tercihi ${profile.dietPref}` : ''}${profile.allergies?.length ? `; alerjiler ${profile.allergies.join(', ')}` : ''}.`)
  if (goal) L.push(`Hedef: ${GOAL_LABEL[goal.type] ?? goal.type}, ${kg(goal.startWeightKg)} → ${kg(goal.targetWeightKg)} kg; ${goal.startDate} – ${goal.endDate} (kalan ${Math.max(0, diffDays(today, goal.endDate))} gün). Plan: günlük ${goal.dailyKcal} kcal, protein ${goal.proteinG} g, karbonhidrat ${goal.carbG} g, yağ ${goal.fatG} g. Güvenli kalori tabanı ${floor} kcal.`)
  else L.push('Aktif hedef yok.')
  const wl: string[] = []
  if (lastWeigh) wl.push(`son tartı ${kg(lastWeigh.raw!)} kg (${lastWeigh.day})`)
  if (trendNow !== null) wl.push(`trend ${kg(trendNow)} kg`)
  if (trendNow !== null && trend14 !== null) wl.push(`son 14 günde trend ${signed(Math.round((trendNow - trend14) * 10) / 10, 1)} kg`)
  if (checkin?.tdee.tdee) wl.push(`ölçülen günlük harcama (adaptif) ${checkin.tdee.tdee} kcal, güven ${checkin.tdee.confidence}`)
  if (checkin?.forecast.day) wl.push(`bu tempoyla hedefe tahmini varış ${checkin.forecast.day}`)
  L.push('Kilo: ' + (wl.length ? wl.join('; ') : 'tartı kaydı yok') + '.')
  // G2: bugün ve dün tam döküm (makrolar + su, kalan/fazla); gece yarısından sonra kullanıcı çoğu zaman hâlâ "dün"ü yaşar
  const dayName = (d: string) => `${d} ${WEEKDAY[dow(d)]}`
  L.push(dayLine(`Bugün (${dayName(today)})`, todayFacts))
  const yest = past.at(-1)
  if (yest) L.push(dayLine(`Dün (${dayName(yest.day)})`, yest))
  // Y1: "bugün" kullanıcının gün sınırına göre; takvim ilerlediyse koç bunu bilsin
  const ds = currentDayStart()
  if (inLateWindow(now, ds)) L.push(`Not: takvimde gece yarısı geçti ama kullanıcının günü ${atTime(ds)} bitiyor; şu an hâlâ ${today} günündesiniz. Kullanıcı "bugün" derken bu günü kastediyor; bu saatte eklenen kayıtlar bu güne yazılır.`)
  else if (hm < 5 * 60) L.push(`Not: saat gece yarısını yeni geçti ve kullanıcının yeni günü (${today}) başladı. Kullanıcı henüz uyumadıysa "kalan", "şu ana kadar" derken dünü (${yest?.day ?? ''}) kastediyor olabilir; mesaj belirsizse dünün değerlerini ver.`)
  const ws: string[] = [`kayıtlı ${week.loggedDays}/7 gün`]
  if (week.avgKcal !== null) ws.push(`ortalama ${week.avgKcal} kcal (hedef ort. ${week.avgTarget})`, `kalori uyumu %${week.adherencePct}`)
  if (week.proteinPct !== null) ws.push(`protein hedefinin %${week.proteinPct}'i`)
  if (week.weekendDiff !== null) ws.push(`hafta sonu − hafta içi ${signed(week.weekendDiff)} kcal`)
  ws.push(`su hedefi ${week.waterGoalDays}/7 gün${week.waterAvg !== null ? `, ortalama ${fmtNum(week.waterAvg)} ml` : ''}`, `antrenman ${week.workouts}, kardiyo ${week.cardioMin} dk, egzersiz toplam ${week.burned} kcal`, `yeni rekor ${week.prs}`)
  L.push('Son 7 gün (bugün hariç): ' + ws.join('; ') + '.')
  L.push('Önceki günler (gün: kalori yenen/hedef · protein · karbonhidrat · yağ g · su ml): ' + past.slice(0, -1).map((d) => `${d.day} ${WEEKDAY[dow(d.day)].slice(0, 3)}: ${d.items ? `${d.eaten}/${d.target} kcal · P ${d.protein}/${d.proteinTarget} · K ${d.carb ?? 0}/${d.carbTarget ?? '?'} · Y ${d.fat ?? 0}/${d.fatTarget ?? '?'}` : 'öğün kaydı yok'} · su ${fmtNum(d.waterMl)}/${fmtNum(d.waterGoal)}${d.workouts ? ' · antrenman' : ''}`).join(' | '))
  if (program) {
    L.push(`Aktif program: ${program.name}. Günler: ` + program.days.map((d) => `"${d.name}": ${d.exercises.map((e) => `${e.name} ${e.sets}×${e.repMin}${e.repMax !== e.repMin ? '–' + e.repMax : ''}`).join(', ') || 'boş'}`).join(' | '))
  } else L.push('Aktif antrenman programı yok.')
  L.push('Güvenlik bayrakları: ' + (safety.flags.length ? safety.flags.map((f) => ({ low_intake: `son 7 günde ${safety.lowDays} gün çok düşük kalori`, no_rest: '7 gündür dinlenme günü yok', high_burn_low_intake: `günlük ortalama ${safety.avgBurn} kcal egzersize karşın taban altı beslenme` }[f])).join('; ') : 'yok') + '.')
  // Faz 7-3: koç her şeyi bilir — vücut kompozisyonu, hedef aşaması, toparlanma, kazanım kalitesi, haftalık öneriler
  const [gs, rec, qual, adv] = await Promise.all([
    goalStatus(userId).catch(() => null),
    recoveryFor(userId, today).catch(() => null),
    goal ? qualityCard(userId, goal, checkin?.forecast.kgPerWeek ?? null, trendNow ?? goal.startWeightKg).catch(() => null) : Promise.resolve(null),
    goal ? weeklyAdvice(userId, goal, checkin?.forecast.kgPerWeek ?? null).catch(() => []) : Promise.resolve([] as string[]),
  ])
  if (profile) {
    const bfp = profile.bodyFatPct ?? estimateBodyFat(profile.sex as Sex, trendNow ?? profile.weightKg, profile.heightCm, ageFromBirthDate(profile.birthDate))
    L.push(`Vücut: yağ oranı %${fmtNum(bfp, 1)} (${profile.bodyFatPct ? (profile.bodyFatSource === 'navy' ? 'ölçülerden' : 'kullanıcı girdi') : 'tahmin'}), yağsız kütle ${kg(leanMass(trendNow ?? profile.weightKg, bfp))} kg.`)
  }
  if (gs) L.push(gs.kind === 'reached' ? `Hedef aşaması: kullanıcı ${kg(gs.target)} kg hedefine ulaştı ve sonraki adımı henüz seçmedi (Bugün'de kart var: kilomu koruyup kas kazan / yeni hedef / şimdilik böyle).` : `Hedef aşaması: hedef tarih geçti, hedefe ${kg(gs.remainingKg)} kg kaldı; kullanıcıya süreyi uzatma kartı gösteriliyor.`)
  if (goal?.phase && goal.phase > 1) L.push(`Bu, kullanıcının ${goal.phase}. hedef aşaması.`)
  if (rec && rec.level !== 'ok') L.push(`Toparlanma: ${rec.level === 'deload' ? 'düşük (bugün %10 hafif önerilir)' : 'orta (ağırlık artışı önerilmiyor)'} — ${rec.reasons.join(', ')}.`)
  if (qual && qual.verdict !== 'unknown') L.push(`Kazanım kalitesi: ${qual.text}`)
  if (adv.length) L.push('Haftalık plan önerileri: ' + adv.join(' '))
  return { text: L.join('\n'), today, goal, sex, floor, safety, programDays: program ? program.days.map((d) => ({ id: d.id, name: d.name, programName: program.name })) : [], todayFacts, week }
}

// ───────────── Y2: kalıcı koç notları ─────────────
const MEMORY_MAX = 30
export async function listMemories(userId: string) {
  return db.select({ id: schema.coachMemories.id, text: schema.coachMemories.text, createdAt: schema.coachMemories.createdAt }).from(schema.coachMemories)
    .where(eq(schema.coachMemories.userId, userId)).orderBy(desc(schema.coachMemories.createdAt)).limit(MEMORY_MAX)
}
export async function addMemories(userId: string, texts: string[]) {
  const have = new Set((await listMemories(userId)).map((m) => m.text.toLocaleLowerCase('tr')))
  const fresh = [...new Set(texts.map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 160)).filter((t) => t.length >= 3 && !have.has(t.toLocaleLowerCase('tr'))))].slice(0, 3)
  if (!fresh.length) return
  await db.insert(schema.coachMemories).values(fresh.map((text) => ({ userId, text })))
  await db.execute(sql`delete from coach_memories where user_id = ${userId} and id not in (select id from coach_memories where user_id = ${userId} order by created_at desc limit ${MEMORY_MAX})`)
}
export async function deleteMemory(userId: string, id: string) {
  await db.delete(schema.coachMemories).where(and(eq(schema.coachMemories.id, id), eq(schema.coachMemories.userId, userId)))
}

// ───────────── Sohbet ─────────────

export type ActionStatus = 'pending' | 'done' | 'cancelled' | 'invalid'
export interface StoredAction {
  type: CoachAction['type']; status: ActionStatus; label: string; error?: string
  data: { weeks?: number; oldEnd?: string; newEnd?: string; dayId?: string; exerciseId?: number; exerciseName?: string; sets?: number; repMin?: number; repMax?: number; ml?: number; drink?: string }
}
export interface MessageView { id: string; role: 'user' | 'assistant'; content: string; actions: StoredAction[]; whatIf: WhatIf | null; mealPlan: MealSuggestion | null; safety: string | null; provider: string | null; createdAt: string }

const longTr = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Kısaltma güvenli mi: kalan sürede hedefe ulaşmak için gereken tempo computePlan'a göre güvenli olmalı. */
async function shortenSafe(userId: string, ctx: CoachContext, daysLeft: number): Promise<string | null> {
  if (ctx.safety.flags.length) return 'Son günlerdeki verilerin nedeniyle hedefi hızlandırmayı şu an önermiyoruz.'
  const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  if (!p || !ctx.goal) return 'Profil ya da hedef yok'
  const series = await weightSeries(userId, addDays(ctx.today, -28), ctx.today)
  const nowKg = series.filter((s) => s.trend !== null).at(-1)?.trend ?? ctx.goal.startWeightKg
  const plan = computePlan({ sex: p.sex as Sex, age: ageFromBirthDate(p.birthDate), heightCm: p.heightCm, weightKg: nowKg, activity: p.activity as Activity, goal: ctx.goal.type as GoalType, targetWeightKg: ctx.goal.targetWeightKg, days: daysLeft, experience: p.experience, bfPct: p.bodyFatPct })
  return plan.safe ? null : `Bu süre güvenli değil (en az ${plan.safeDays} gün gerekir).`
}

/** Modelin önerdiği eylemi doğrular ve kullanıcıya gösterilecek açıklamayı üretir (henüz uygulanmaz). */
async function resolveAction(userId: string, a: CoachAction, ctx: CoachContext): Promise<StoredAction> {
  const bad = (label: string, error: string): StoredAction => ({ type: a.type, status: 'invalid', label, error, data: {} })
  if (a.type === 'goal_date') {
    if (!ctx.goal || !a.weeks) return bad('Hedef tarihini değiştir', 'Aktif hedef yok')
    const s = shiftGoal(ctx.goal.endDate, ctx.today, a.weeks)
    const label = `Hedef tarihini ${Math.abs(a.weeks)} hafta ${a.weeks > 0 ? 'uzat' : 'kısalt'}`
    if ('error' in s) return bad(label, s.error)
    if (a.weeks < 0) { const e = await shortenSafe(userId, ctx, s.daysLeft); if (e) return bad(label, e) }
    return { type: a.type, status: 'pending', label: `${label}: ${longTr(ctx.goal.endDate)} → ${longTr(s.newEnd)}`, data: { weeks: a.weeks, oldEnd: ctx.goal.endDate, newEnd: s.newEnd } }
  }
  if (a.type === 'add_exercise') {
    const day = matchProgramDay(a.programDay ?? '', ctx.programDays)
    if (!day) return bad(`${a.exercise ?? 'Hareket'} ekle`, ctx.programDays.length ? 'Programda bu gün bulunamadı' : 'Aktif program yok')
    const [ex] = a.exercise ? await searchExercises(userId, { q: a.exercise, limit: 1 }) : []
    if (!ex) return bad(`${a.exercise ?? 'Hareket'} ekle`, 'Hareket kütüphanede bulunamadı')
    const time = ex.kind === 'time' // süreli hareket (plank vb.): tekrar yerine 45 sn (addExerciseToDay varsayılanı)
    const sets = a.sets ?? 3, repMin = time ? 1 : a.repMin ?? 8, repMax = time ? 1 : Math.max(repMin, a.repMax ?? 12)
    return { type: a.type, status: 'pending', label: `"${day.name}" gününe ${ex.nameTr} ekle (${sets} × ${time ? '45 sn' : repMin + (repMax !== repMin ? '–' + repMax : '')})`, data: { dayId: day.id, exerciseId: ex.id, exerciseName: ex.nameTr, sets, repMin, repMax } }
  }
  if (a.type === 'plan_menu') {
    const day = addDays(ctx.today, 1)
    return { type: a.type, status: 'pending', label: `Yarın (${longTr(day)}) için menü hazırla`, data: { newEnd: day } }
  }
  const ml = a.ml ?? 0
  if (ml < 50) return bad('Su ekle', 'Miktar yok')
  const drink = a.drink ?? 'water'
  return { type: 'log_water', status: 'pending', label: `${fmtNum(ml)} ml ${drink === 'water' ? 'su' : 'içecek'} ekle`, data: { ml, drink } }
}

async function resolveWhatIf(userId: string, items: { name: string; grams: number }[], ctx: CoachContext): Promise<WhatIf | null> {
  if (!items.length) return null
  const resolved = []
  for (const it of items.slice(0, 5)) {
    const [h] = (await searchFoods(userId, it.name, 3)).filter((x) => !x.partial)
    resolved.push({ name: it.name, grams: Math.round(it.grams), foodName: h?.name ?? null, kcal: h ? macrosFor(h.per100 as Nutrients, it.grams).kcal : null })
  }
  const end = ctx.goal ? (addDays(ctx.today, 7) < ctx.goal.endDate ? addDays(ctx.today, 7) : ctx.goal.endDate) : addDays(ctx.today, 7)
  const upcoming = (await dayTargets(userId, addDays(ctx.today, 1), end, ctx.goal)).filter((u) => !u.closed).map((u) => ({ day: u.day, base: u.base, current: u.adjustment }))
  return whatIfImpact({ items: resolved, target: ctx.todayFacts.target, eaten: ctx.todayFacts.eaten, burned: ctx.todayFacts.burned, itemCount: ctx.todayFacts.items, upcoming, floor: ctx.floor })
}

function toView(r: typeof schema.aiMessages.$inferSelect): MessageView {
  return { id: r.id, role: r.role as 'user' | 'assistant', content: r.content, actions: (r.actions ?? []) as StoredAction[], whatIf: (r.whatIf ?? null) as WhatIf | null, mealPlan: (r.mealPlan ?? null) as MealSuggestion | null, safety: r.safety, provider: r.provider, createdAt: r.createdAt.toISOString() }
}

export async function listConversations(userId: string) {
  return db.select({ id: schema.aiConversations.id, title: schema.aiConversations.title, updatedAt: schema.aiConversations.updatedAt }).from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.userId, userId), isNull(schema.aiConversations.deletedAt))).orderBy(desc(schema.aiConversations.updatedAt)).limit(20)
}
export async function conversationMessages(userId: string, conversationId: string): Promise<MessageView[]> {
  const rows = await db.select().from(schema.aiMessages).where(and(eq(schema.aiMessages.conversationId, conversationId), eq(schema.aiMessages.userId, userId))).orderBy(asc(schema.aiMessages.createdAt))
  return rows.map(toView)
}
async function ownConversation(userId: string, id: string) {
  const [c] = await db.select().from(schema.aiConversations).where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.userId, userId), isNull(schema.aiConversations.deletedAt))).limit(1)
  return c ?? null
}
export async function deleteConversation(userId: string, id: string) {
  // Sohbet içeriği silinir (mesajlar kalıcı olarak), başlık yumuşak silinir
  const c = await ownConversation(userId, id)
  if (!c) return
  await db.delete(schema.aiMessages).where(and(eq(schema.aiMessages.conversationId, id), eq(schema.aiMessages.userId, userId)))
  await db.update(schema.aiConversations).set({ deletedAt: new Date(), title: '(silindi)' }).where(eq(schema.aiConversations.id, id))
}

/** Kullanıcı mesajını işler: güvenlik kontrolü → bağlam → model → eylem/ne olur çözümü → kayıt. */
export async function sendCoachMessage(userId: string, conversationId: string | null, text: string): Promise<{ conversationId: string; user: MessageView; reply: MessageView; calls: number; memories: { id: string; text: string }[] }> {
  const msg = text.trim().slice(0, 1000)
  if (msg.length < 2) throw new AiError('Mesaj çok kısa', 'hata')
  let conv = conversationId ? await ownConversation(userId, conversationId) : null
  if (!conv) [conv] = await db.insert(schema.aiConversations).values({ userId, title: msg.slice(0, 60) }).returning()
  const prev = await db.select({ role: schema.aiMessages.role, content: schema.aiMessages.content }).from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, conv.id)).orderBy(desc(schema.aiMessages.createdAt)).limit(HISTORY)
  const risk = riskyText(msg)
  const [userRow] = await db.insert(schema.aiMessages).values({ conversationId: conv.id, userId, role: 'user', content: msg, safety: risk }).returning()
  const ctx = await coachContext(userId)
  const prefs = await coachPrefs(userId)
  const persona = PERSONAS[(prefs.persona as Persona) in PERSONAS ? (prefs.persona as Persona) : 'supportive']
  // Y2: kalıcı notlar ve uzun sohbet özeti bağlama girer
  const notes = await listMemories(userId)
  const extra = [
    notes.length ? 'NOTLAR (kullanıcı hakkında kalıcı, önceki sohbetlerden):\n' + notes.map((n) => '- ' + n.text).join('\n') : '',
    conv.summary ? 'SOHBET ÖZETİ (bu sohbetin eski kısmı):\n' + conv.summary : '',
  ].filter(Boolean).join('\n\n')
  const system = persona.prompt + (risk ? `\nUYARI: kullanıcının mesajında ${risk === 'crisis' ? 'kendine zarar verme' : 'yeme bozukluğu'} işareti var; kural 3'ü uygula.` : '') + '\n\n' + ctx.text + (extra ? '\n\n' + extra : '')
  const history = prev.reverse().map((p) => ({ role: p.role as 'user' | 'assistant', text: p.content }))
  let out: Awaited<ReturnType<typeof runTask<'coach'>>>
  let calls = 1
  try {
    out = await runTask(userId, 'coach', { text: msg, system, history })
    // Y2: model veri istediyse sonuçlarla bir kez daha çağrılır (en çok 1 tur)
    if (out.result.lookups?.length && !risk) {
      const found = await runLookups(userId, out.result.lookups)
      if (found.length) { calls++; out = await runTask(userId, 'coach', { text: msg, system: system + '\n\nARAÇ SONUÇLARI (uygulamanın hesapladığı, bu soruya özel):\n' + found.map((f) => '- ' + f).join('\n') + '\nBu sonuçlarla tam cevabı ver; lookups boş olsun.', history }) }
    }
  } catch (e) {
    if (risk) {
      // AI yoksa bile riskli mesajda destek kartı gösterilir
      const [r] = await db.insert(schema.aiMessages).values({ conversationId: conv.id, userId, role: 'assistant', content: SUPPORT[risk].body, safety: risk, provider: null }).returning()
      return { conversationId: conv.id, user: toView(userRow), reply: toView(r), calls: 0, memories: [] }
    }
    await db.delete(schema.aiMessages).where(eq(schema.aiMessages.id, userRow.id))
    throw e
  }
  const res = out.result
  const safety = risk ?? (res.safety === 'kriz' ? 'crisis' : res.safety === 'yeme-bozuklugu' ? 'ed' : res.safety === 'tibbi' ? 'medical' : null)
  const careful = safety === 'crisis' || safety === 'ed'
  const actions = careful ? [] : await Promise.all(res.actions.slice(0, 3).map((a) => resolveAction(userId, a, ctx)))
  const whatIf = careful ? null : await resolveWhatIf(userId, res.whatIf, ctx)
  // Y2: öğün kurucu kartı — modelin verdiği sınırlar, yoksa mesajdan okunan sınırlar
  let mealPlan: MealSuggestion | null = null
  if (!careful && res.mealPlan) {
    const fromText = parseLimits(msg)
    const lim = { protein: res.mealPlan.protein ?? fromText.protein ?? null, carb: res.mealPlan.carb ?? fromText.carb ?? null, fat: res.mealPlan.fat ?? fromText.fat ?? null, kcal: res.mealPlan.kcal ?? fromText.kcal ?? null }
    mealPlan = await suggestMeals(userId, lim).catch(() => null)
  }
  if (!careful && res.remember?.length) await addMemories(userId, res.remember)
  if (res.memo?.trim()) await db.update(schema.aiConversations).set({ summary: res.memo.trim().slice(0, 600) }).where(eq(schema.aiConversations.id, conv.id))
  const [r] = await db.insert(schema.aiMessages).values({ conversationId: conv.id, userId, role: 'assistant', content: res.reply, actions, whatIf, mealPlan, safety, provider: out.provider }).returning()
  await db.update(schema.aiConversations).set({ updatedAt: new Date() }).where(eq(schema.aiConversations.id, conv.id))
  const memories = (await listMemories(userId)).map((m) => ({ id: m.id, text: m.text }))
  return { conversationId: conv.id, user: toView(userRow), reply: toView(r), calls, memories }
}

/** Onaylanan eylemi yeniden doğrulayıp uygular. Su kaydı çağıran sunucu aksiyonunda yapılır (`water`). */
export async function applyCoachAction(userId: string, messageId: string, index: number, decision: 'confirm' | 'cancel', water: (ml: number, drink: string) => Promise<{ ok: boolean; error?: string }>): Promise<StoredAction> {
  const [m] = await db.select().from(schema.aiMessages).where(and(eq(schema.aiMessages.id, messageId), eq(schema.aiMessages.userId, userId), eq(schema.aiMessages.role, 'assistant'))).limit(1)
  if (!m) throw new Error('Mesaj yok')
  const list = (m.actions ?? []) as StoredAction[]
  const a = list[index]
  if (!a || a.status !== 'pending') throw new Error('Bu eylem zaten işlendi')
  // eylemi atomik olarak sahiplen: çift dokunuş / iki sekme aynı eylemi iki kez uygulamasın
  const claim = await db.execute(sql`update ai_messages set actions = jsonb_set(actions, ${`{${index},status}`}::text[], '"processing"'::jsonb)
    where id = ${m.id} and user_id = ${userId} and actions->(${index}::int)->>'status' = 'pending' returning id`)
  if (!claim.length) throw new Error('Bu eylem zaten işlendi')
  try { return await runCoachAction(userId, m.id, list, index, a, decision, water) }
  catch (e) { // beklenmeyen hata: eylem yeniden denenebilsin
    await db.execute(sql`update ai_messages set actions = jsonb_set(actions, ${`{${index},status}`}::text[], '"pending"'::jsonb) where id = ${m.id} and actions->(${index}::int)->>'status' = 'processing'`)
    throw e
  }
}

async function runCoachAction(userId: string, messageId: string, list: StoredAction[], index: number, a: StoredAction, decision: 'confirm' | 'cancel', water: (ml: number, drink: string) => Promise<{ ok: boolean; error?: string }>): Promise<StoredAction> {
  const m = { id: messageId }
  const save = async (next: StoredAction) => {
    list[index] = next
    await db.update(schema.aiMessages).set({ actions: list }).where(eq(schema.aiMessages.id, m.id))
    return next
  }
  if (decision === 'cancel') return save({ ...a, status: 'cancelled' })
  if (a.type === 'goal_date') {
    const ctx = await coachContext(userId)
    if (!ctx.goal || ctx.goal.endDate !== a.data.oldEnd) return save({ ...a, status: 'invalid', error: 'Hedef bu arada değişti' })
    const s = shiftGoal(ctx.goal.endDate, ctx.today, a.data.weeks!)
    if ('error' in s) return save({ ...a, status: 'invalid', error: s.error })
    if (a.data.weeks! < 0) { const e = await shortenSafe(userId, ctx, s.daysLeft); if (e) return save({ ...a, status: 'invalid', error: e }) }
    await db.update(schema.goals).set({ endDate: s.newEnd }).where(and(eq(schema.goals.id, ctx.goal.id), eq(schema.goals.userId, userId)))
    await publish(userId, 'plan.adjusted', { kind: 'coach_goal_date', from: ctx.goal.endDate, to: s.newEnd })
  } else if (a.type === 'add_exercise') {
    try {
      await addExerciseToDay(userId, a.data.dayId!, a.data.exerciseId!) // sahiplik burada denetlenir
      const [pe] = await db.select().from(schema.programExercises).where(eq(schema.programExercises.dayId, a.data.dayId!)).orderBy(desc(schema.programExercises.idx)).limit(1)
      if (pe) await updateProgramExercise(userId, pe.id, { sets: a.data.sets!, repMin: a.data.repMin!, repMax: a.data.repMax!, rir: pe.rir, rest: pe.rest, seconds: pe.seconds, setType: pe.setType })
    } catch (e) { return save({ ...a, status: 'invalid', error: (e as Error).message }) }
  } else if (a.type === 'plan_menu') {
    try { await createMenu(userId, { startDay: a.data.newEnd && a.data.newEnd > dayString() ? a.data.newEnd : addDays(dayString(), 1), days: 1, budget: 'orta', prep: false, note: '' }) }
    catch (e) { return save({ ...a, status: 'invalid', error: (e as Error).message }) }
  } else {
    const r = await water(a.data.ml!, a.data.drink ?? 'water')
    if (!r.ok) return save({ ...a, status: 'invalid', error: r.error ?? 'Su eklenemedi' })
  }
  await publish(userId, 'coach.action', { type: a.type, messageId })
  return save({ ...a, status: 'done' })
}

// ───────────── Günlük içgörü ─────────────

export interface InsightView { id: string; key: string; tone: 'good' | 'warn' | 'info' | 'care'; title: string; body: string; ask: string | null; provider: string | null }

const numbersIn = (t: string) => (t.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').match(/\d+(?:,\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')))

/** Bugünün tek içgörüsü (yoksa üretir). Güvenlik bayrağı varsa destek kartı önceliklidir. Kullanıcı AI hakkına sayılmaz. */
export async function dailyInsight(userId: string): Promise<InsightView | null> {
  const prefs = await coachPrefs(userId)
  if (!prefs.insights) return null
  const today = dayString()
  const view = (r: typeof schema.aiInsights.$inferSelect): InsightView | null => r.dismissedAt ? null : ({ id: r.id, key: r.key, tone: (r.data.tone as InsightView['tone']) ?? 'info', title: r.title, body: r.body, ask: (r.data.ask as string) ?? null, provider: r.provider })
  const [have] = await db.select().from(schema.aiInsights).where(and(eq(schema.aiInsights.userId, userId), eq(schema.aiInsights.kind, 'daily'), eq(schema.aiInsights.period, today))).limit(1)
  if (have) return view(have)

  const goal = await activeGoal(userId)
  const floor = calorieFloor(await sexOf(userId))
  const days = await gatherDays(userId, addDays(today, -14), addDays(today, -1))
  const safety = safetyFlags(days, floor)
  let row: typeof schema.aiInsights.$inferInsert
  if (safety.flags.length) {
    const f = safety.flags[0]
    row = { userId, kind: 'daily', period: today, key: 'safety_' + f, title: SUPPORT[f].title, body: SUPPORT[f].body, data: { tone: 'care', ask: null, flags: safety.flags }, provider: null }
  } else {
    const series = await weightSeries(userId, addDays(today, -21), today)
    const tr = series.filter((s) => s.trend !== null)
    const now = tr.at(-1)?.trend ?? null, then = tr.filter((s) => s.day <= addDays(today, -14)).at(-1)?.trend ?? null
    const ch14 = now !== null && then !== null ? Math.round((now - then) * 10) / 10 : null
    let extra: InsightFact[] = []
    try {
      const w = await getWaterInsights(userId)
      extra = w.insights.filter((i) => i.tone !== 'good').slice(0, 1).map((i) => ({ key: 'water_' + i.id, tone: i.tone, text: i.text, numbers: numbersIn(i.text), ask: 'Su alışkanlığımı nasıl düzeltirim?' }))
    } catch { /* su verisi yoksa yok */ }
    const used = (await db.select({ key: schema.aiInsights.key }).from(schema.aiInsights).where(and(eq(schema.aiInsights.userId, userId), eq(schema.aiInsights.kind, 'daily'), gte(schema.aiInsights.period, addDays(today, -7))))).map((r) => r.key)
    const fact = pickInsight(insightCandidates(days, (goal?.type as 'lose') ?? 'lose', ch14, extra), used)
    let title: string = ({ good: 'Güzel gidiyor', warn: 'Dikkat çeken bir şey', info: 'Bugünün notu' } as const)[fact.tone], body = fact.text, provider: string | null = null
    if (fact.key !== 'start' && (await aiAvailable())) {
      try {
        const persona = PERSONAS[(prefs.persona as Persona) in PERSONAS ? (prefs.persona as Persona) : 'supportive']
        const r = await runTask(userId, 'insight', { text: `Gerçek: ${fact.text}\nİzinli sayılar: ${fact.numbers.join(', ') || 'yok'}`, system: persona.prompt })
        if (numbersAllowed(r.result.title + ' ' + r.result.body, fact.numbers)) { title = r.result.title; body = r.result.body; provider = r.provider }
      } catch { /* kural metni kalır */ }
    }
    row = { userId, kind: 'daily', period: today, key: fact.key, title, body, data: { tone: fact.tone, ask: fact.ask, rule: fact.text }, provider }
  }
  await db.insert(schema.aiInsights).values(row).onConflictDoNothing()
  const [r] = await db.select().from(schema.aiInsights).where(and(eq(schema.aiInsights.userId, userId), eq(schema.aiInsights.kind, 'daily'), eq(schema.aiInsights.period, today))).limit(1)
  return r ? view(r) : null
}
export async function dismissInsight(userId: string, id: string) {
  await db.update(schema.aiInsights).set({ dismissedAt: new Date() }).where(and(eq(schema.aiInsights.id, id), eq(schema.aiInsights.userId, userId)))
}

// ───────────── Haftalık rapor ─────────────

export const mondayOf = (day: string) => addDays(day, -((dow(day) + 6) % 7))
/** Rapor Pazar 18.00'de hazır olur; o saatten önce son tamamlanan hafta gösterilir. */
export function latestReportWeek(now = new Date()): string {
  const today = dayString(now)
  const mon = mondayOf(today)
  return dow(today) === 0 && minuteOfDay(now) >= 18 * 60 ? mon : addDays(mon, -7)
}
export const reportReady = (weekStart: string, now = new Date()) => weekStart <= latestReportWeek(now)

export interface WeeklyView { weekStart: string; weekEnd: string; stats: WeekStats; summary: string; suggestions: string[]; provider: string | null; ready: boolean; safetyFlags: string[] }

function weekNumbers(s: WeekStats): number[] {
  const n = [s.loggedDays, s.avgKcal, s.avgTarget, s.adherencePct, s.proteinPct, s.weekendDiff, s.weightChange, s.weightLast, s.waterAvg, s.waterGoalDays, s.waterDays, s.workouts, s.cardioMin, s.volumeKg, s.burned, s.prs, ...s.hardest.map((h) => h.over)]
  const out = n.filter((x): x is number => typeof x === 'number')
  if (s.avgKcal !== null && s.avgTarget !== null) out.push(s.avgKcal - s.avgTarget)
  return out
}
function ruleSummary(s: WeekStats): string {
  const p: string[] = []
  if (s.avgKcal !== null) p.push(`Bu hafta ${s.loggedDays} gün kayıt tuttun; ortalama ${fmtNum(s.avgKcal)} kcal aldın (hedef ortalaması ${fmtNum(s.avgTarget!)}), kalori uyumun %${s.adherencePct}.`)
  else p.push('Bu hafta yeterli öğün kaydı yok.')
  if (s.weightChange !== null) p.push(`Trend kilon ${signed(s.weightChange, 1)} kg değişti.`)
  p.push(`Su hedefini ${s.waterGoalDays} gün tamamladın; ${s.workouts} antrenman ve ${s.cardioMin} dk kardiyo yaptın${s.prs ? `, ${s.prs} yeni rekor kırdın` : ''}.`)
  return p.join(' ')
}

export async function weeklyReport(userId: string, weekStart: string): Promise<WeeklyView> {
  const ws = mondayOf(weekStart), we = addDays(ws, 6), today = dayString()
  const ready = reportReady(ws)
  const goal = await activeGoal(userId)
  const [days, series, prs] = await Promise.all([
    gatherDays(userId, ws, we < today ? we : today),
    weightSeries(userId, addDays(ws, -21), we < today ? we : today),
    db.execute<{ n: number }>(sql`select count(*)::int as n from personal_records pr join workouts w on w.id = pr.workout_id where pr.user_id = ${userId} and w.day between ${ws} and ${we}`),
  ])
  const stats = weekStats(days, series.filter((s) => s.raw !== null).map((s) => ({ day: s.day, kg: s.raw! })), Number(prs[0]?.n ?? 0))
  const floor = calorieFloor(await sexOf(userId))
  const flags = safetyFlags(days, floor).flags
  const gtype = (goal?.type as 'lose') ?? 'lose'
  const base: WeeklyView = { weekStart: ws, weekEnd: we, stats, summary: ruleSummary(stats), suggestions: ruleSuggestions(stats, gtype), provider: null, ready, safetyFlags: flags }
  if (!ready) return base
  const [have] = await db.select().from(schema.aiInsights).where(and(eq(schema.aiInsights.userId, userId), eq(schema.aiInsights.kind, 'weekly'), eq(schema.aiInsights.period, ws))).limit(1)
  if (have) return { ...base, summary: have.body, suggestions: (have.data.suggestions as string[]) ?? base.suggestions, provider: have.provider }
  let summary = base.summary, suggestions = base.suggestions, provider: string | null = null
  if (days.some((d) => d.items > 0 || d.workouts > 0 || d.cardioMin > 0 || d.waterMl > 0) && (await aiAvailable())) {
    try {
      const prefs = await coachPrefs(userId)
      const persona = PERSONAS[(prefs.persona as Persona) in PERSONAS ? (prefs.persona as Persona) : 'supportive']
      const nums = weekNumbers(stats)
      const r = await runTask(userId, 'weekly', {
        text: `Hafta ${ws} – ${we}. Hedef: ${GOAL_LABEL[gtype]}. İstatistikler (JSON): ${JSON.stringify(stats)}\nGüvenlik bayrakları: ${flags.join(', ') || 'yok'}\nİzinli sayılar: ${nums.join(', ')}`,
        system: persona.prompt,
      })
      if (numbersAllowed([r.result.summary, ...r.result.suggestions].join(' '), nums)) { summary = r.result.summary; suggestions = r.result.suggestions; provider = r.provider }
    } catch { /* kural metni */ }
  }
  // pazar akşamı rapor hazır olsa da gün bitmedi: kalıcı kayıt hafta tamamen kapanınca (pazartesiden itibaren) yazılır
  if (today > we) await db.insert(schema.aiInsights).values({ userId, kind: 'weekly', period: ws, key: 'week', title: `Hafta ${ws}`, body: summary, data: { suggestions, stats: stats as unknown as Record<string, unknown> }, provider }).onConflictDoNothing()
  return { ...base, summary, suggestions, provider }
}

export async function pastReports(userId: string) {
  return db.select({ period: schema.aiInsights.period }).from(schema.aiInsights).where(and(eq(schema.aiInsights.userId, userId), eq(schema.aiInsights.kind, 'weekly'))).orderBy(desc(schema.aiInsights.period)).limit(12)
}


/** P-7 haftalık akıllı özet (Bugün kartı, pazartesi–salı): geçen haftanın 4 temel sayısı + tek cümlelik öneri. AI çağırmaz. */
export async function lastWeekBrief(userId: string, today = dayString()) {
  const wd = new Date(today + 'T12:00:00Z').getUTCDay()
  if (wd !== 1 && wd !== 2) return null
  const mon = addDays(today, -(wd - 1) - 7), sun = addDays(mon, 6)
  const [days, series] = await Promise.all([gatherDays(userId, mon, sun), weightSeries(userId, addDays(mon, -21), sun)])
  if (!days.some((d) => d.items > 0 || d.workouts > 0 || d.waterMl > 0)) return null
  const s = weekStats(days, series.filter((x) => x.raw !== null).map((x) => ({ day: x.day, kg: x.raw! })))
  const tip = s.loggedDays < 4 ? 'Bu hafta en az 5 gün kayıt hedefle; plan ancak böyle doğru ayarlanır.'
    : s.weekendDiff !== null && s.weekendDiff > 300 ? `Hafta sonu ortalaman hafta içinden ${Math.round(s.weekendDiff)} kcal fazla; cumartesi için önceden plan yap.`
    : s.proteinPct !== null && s.proteinPct < 80 ? 'Protein hedefinin altında kaldın; her öğüne bir protein kaynağı ekle.'
    : s.workouts === 0 ? 'Geçen hafta antrenman yoktu; bu hafta kısa da olsa 2 antrenman planla.'
    : 'İyi gidiyorsun; aynı ritmi koru.'
  return { weekStart: mon, loggedDays: s.loggedDays, adherencePct: s.adherencePct, weightChange: s.weightChange, workouts: s.workouts, tip }
}
