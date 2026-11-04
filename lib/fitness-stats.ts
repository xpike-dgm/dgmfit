import 'server-only'
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString } from './time'
import { e1rm, type SetType } from './training'
import { alternatives, detectPlateau, liftOf, recovery, setBandStatus, setsByMuscle, strengthLevel, type ExLite } from './progress'
import { exerciseHistory } from './fitness-data'
import { MUSCLE_ORDER } from './exercise-labels'

const monday = (d: string) => { const dow = new Date(d + 'T12:00:00Z').getUTCDay(); return addDays(d, -((dow + 6) % 7)) }

/** İstatistik ekranı: haftalık hacim (12 hafta), antrenman takvimi (12 hafta), bu haftanın kas başına seti, son 7 gün ısı haritası + toparlanma. */
export async function statsOverview(userId: string) {
  const today = dayString()
  const from = addDays(monday(today), -7 * 11)
  const [workouts, sets7] = await Promise.all([
    db.select({ day: schema.workouts.day, volume: schema.workouts.volumeKg, sets: schema.workouts.workSets, min: schema.workouts.durationSec })
      .from(schema.workouts).where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt), sql`${schema.workouts.day} >= ${from}`)),
    db.execute<{ primary: string[]; secondary: string[]; completed_at: string; day: string }>(sql`
      select e.primary_muscles as primary, e.secondary_muscles as secondary, s.completed_at, w.day::text as day
      from workout_sets s join workouts w on w.id = s.workout_id join exercises e on e.id = s.exercise_id
      where s.user_id = ${userId} and w.deleted_at is null and s.type <> 'warmup' and w.day >= ${addDays(today, -6)}`),
  ])
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(from, i * 7)).map((w) => {
    const ws = workouts.filter((x) => x.day >= w && x.day < addDays(w, 7))
    return { week: w, volume: Math.round(ws.reduce((a, x) => a + x.volume, 0)), workouts: ws.length, sets: ws.reduce((a, x) => a + x.sets, 0) }
  })
  const calendar = [...new Set(workouts.map((w) => w.day))]
  const thisWeek = sets7.filter((s) => s.day >= monday(today))
  const weekly = setsByMuscle(thisWeek.map((s) => ({ primary: s.primary, secondary: s.secondary })))
  const last7 = setsByMuscle(sets7.map((s) => ({ primary: s.primary, secondary: s.secondary })))
  const now = Date.now()
  const heat = MUSCLE_ORDER.map((m) => {
    const hits = sets7.filter((s) => s.primary.includes(m) || s.secondary.includes(m))
    const last = hits.length ? Math.max(...hits.map((h) => Date.parse(h.completed_at))) : null
    const hoursAgo = last ? (now - last) / 3600000 : null
    const recent48 = setsByMuscle(hits.filter((h) => now - Date.parse(h.completed_at) < 48 * 3600000).map((h) => ({ primary: h.primary, secondary: h.secondary })))[m] ?? 0
    return { muscle: m, sets7: last7[m] ?? 0, week: weekly[m] ?? 0, band: setBandStatus(weekly[m] ?? 0), status: recovery(hoursAgo, recent48), hoursAgo: hoursAgo === null ? null : Math.round(hoursAgo) }
  })
  return { today, from, weeks, calendar, heat }
}

export async function exerciseProgress(userId: string, exerciseId: number) {
  const [x] = await db.select().from(schema.exercises).where(and(eq(schema.exercises.id, exerciseId), isNull(schema.exercises.deletedAt), or(eq(schema.exercises.source, 'fedb'), eq(schema.exercises.userId, userId)))).limit(1)
  if (!x) return null
  const hist = (await exerciseHistory(userId, [exerciseId], 60)).get(exerciseId) ?? []
  const series = hist.map((h) => ({ day: h.day, e1rm: Math.max(0, ...h.sets.filter((s) => s.type !== ('warmup' as SetType)).map((s) => e1rm(s.kg, s.reps, s.rir))) }))
  const today = dayString()
  const [pe] = await db.select({ repMin: schema.programExercises.repMin, repMax: schema.programExercises.repMax }).from(schema.programExercises).where(eq(schema.programExercises.exerciseId, exerciseId)).limit(1)
  const plateau = detectPlateau(series, today, pe)
  const [profile] = await db.select({ weightKg: schema.profiles.weightKg, sex: schema.profiles.sex }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const lift = liftOf(x.key)
  const best = Math.max(0, ...series.map((s) => s.e1rm))
  const level = lift && profile && best ? strengthLevel(lift, best, profile.weightKg, profile.sex as 'male' | 'female') : null
  const [gym] = await db.select({ equipment: schema.gymSettings.equipment }).from(schema.gymSettings).where(eq(schema.gymSettings.userId, userId)).limit(1)
  const pool = await db.select({
    id: schema.exercises.id, nameTr: schema.exercises.nameTr, primary: schema.exercises.primary, secondary: schema.exercises.secondary, equipment: schema.exercises.equipment,
    kind: schema.exercises.kind, pattern: schema.exercises.pattern, mechanic: schema.exercises.mechanic, curated: schema.exercises.curated, category: schema.exercises.category,
  }).from(schema.exercises).where(and(isNull(schema.exercises.deletedAt), or(eq(schema.exercises.source, 'fedb'), eq(schema.exercises.userId, userId)), sql`${schema.exercises.primary} ->> 0 = ${x.primary[0] ?? ''}`))
  const alts = x.primary.length ? alternatives(x as unknown as ExLite, pool as ExLite[], gym ? new Set(gym.equipment) : undefined) : []
  return { exercise: x, series, plateau, level, lift, best, alternatives: alts }
}

/** Canlı mod "istasyon dolu": hareketin alternatifleri (kimlik + ad). */
export async function alternativesFor(userId: string, exerciseId: number) {
  const p = await exerciseProgress(userId, exerciseId)
  return p?.alternatives.map((a) => ({ id: a.id, nameTr: a.nameTr, equipment: a.equipment })) ?? []
}

// ───────── Vücut ölçüleri ─────────
export const MEASURES = ['waistCm', 'chestCm', 'hipsCm', 'armCm', 'thighCm', 'calfCm', 'neckCm', 'bodyFatPct'] as const
export type MeasureKey = (typeof MEASURES)[number]
export const MEASURE_LABEL: Record<MeasureKey, string> = { waistCm: 'Bel', chestCm: 'Göğüs', hipsCm: 'Kalça', armCm: 'Kol', thighCm: 'Uyluk', calfCm: 'Baldır', neckCm: 'Boyun', bodyFatPct: 'Yağ oranı' }

export async function listMeasurements(userId: string) {
  return db.select().from(schema.bodyMeasurements).where(and(eq(schema.bodyMeasurements.userId, userId), isNull(schema.bodyMeasurements.deletedAt))).orderBy(desc(schema.bodyMeasurements.day), desc(schema.bodyMeasurements.createdAt)).limit(60)
}
export async function addMeasurement(userId: string, day: string, v: Partial<Record<MeasureKey, number | null>>, note: string | null) {
  await db.insert(schema.bodyMeasurements).values({ userId, day, ...v, note })
}
export async function deleteMeasurement(userId: string, id: number) {
  await db.update(schema.bodyMeasurements).set({ deletedAt: new Date() }).where(and(eq(schema.bodyMeasurements.id, id), eq(schema.bodyMeasurements.userId, userId)))
}

export async function setExercisePhoto(userId: string, exerciseId: number, mediaId: string) {
  const r = await db.update(schema.exercises).set({ photoId: mediaId }).where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.userId, userId), eq(schema.exercises.source, 'user'))).returning({ id: schema.exercises.id })
  return r.length > 0
}
