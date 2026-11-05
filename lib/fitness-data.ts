import 'server-only'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { exerciseMedia } from './licensed'
import { addDays, dayString } from './time'
import { publish } from './events'
import { normalizeSearch } from './nutrition'
import { ageFromBirthDate, type Sex } from './calc'
import { activeGoal, refreshClosedDay } from './fit-data'
import { cardioKcal, detectPRs, e1rm, mergeRecords, sessionRecords, setVolume, strengthKcal, type CardioType, type ExKind, type Intensity, type LoggedSet, type Records, type Session, type SetType } from './training'
import { TEMPLATES, generateProgram, instantiate, type ProgramDay } from './programs'
import { detectPlateau, periodTarget, weekIndex, type Periodization } from './progress'
import { gzAdvance, gzSets, type GzState, type Tier } from './schemes'
import { prSuspicious } from './social-rank'
import { dayMacros } from './food-data'
import { minuteOfDay } from './water-data'

export type Exercise = typeof schema.exercises.$inferSelect
const e1rmOf = (x: { kg: number; reps: number; rir: number | null }) => e1rm(x.kg, x.reps, x.rir)
const MEDIA = '/media/exercises/'
export const imageUrl = (p: string) => MEDIA + p

export async function ensureGym(userId: string) {
  const [g] = await db.select().from(schema.gymSettings).where(eq(schema.gymSettings.userId, userId)).limit(1)
  if (g) return g
  await db.insert(schema.gymSettings).values({ userId }).onConflictDoNothing()
  const [n] = await db.select().from(schema.gymSettings).where(eq(schema.gymSettings.userId, userId)).limit(1)
  return n
}

const visible = (userId: string) => and(isNull(schema.exercises.deletedAt), or(isNull(schema.exercises.userId), eq(schema.exercises.userId, userId)))

export interface ExerciseFilter { q?: string; muscle?: string; equipment?: string; pattern?: string; level?: string; limit?: number }

/** Kütüphane araması: Türkçe/İngilizce ad + takma ad (trigram, yazım hatasına dayanıklı); küratörlü ve özel hareketler önce. */
export async function searchExercises(userId: string, f: ExerciseFilter) {
  const q = f.q ? normalizeSearch(f.q) : ''
  const conds = [visible(userId)]
  if (f.muscle) conds.push(sql`${schema.exercises.primary} ? ${f.muscle}`)
  if (f.equipment) conds.push(eq(schema.exercises.equipment, f.equipment))
  if (f.pattern) conds.push(eq(schema.exercises.pattern, f.pattern))
  if (f.level) conds.push(eq(schema.exercises.level, f.level))
  if (q) conds.push(sql`(${schema.exercises.search} like ${'%' + q + '%'} or word_similarity(${q}, ${schema.exercises.search}) > 0.45)`)
  // arama yokken puan sıralaması eklenmez (sabit "order by 0" sütun numarası sayılıp hata veriyordu)
  const score = q ? [desc(sql`(case when ${schema.exercises.search} like ${q + '%'} then 3 when ${schema.exercises.search} like ${'%' + q + '%'} then 2 else word_similarity(${q}, ${schema.exercises.search}) end)`)] : []
  return db.select({
    id: schema.exercises.id, key: schema.exercises.key, nameTr: schema.exercises.nameTr, nameEn: schema.exercises.nameEn, equipment: schema.exercises.equipment,
    primary: schema.exercises.primary, kind: schema.exercises.kind, pattern: schema.exercises.pattern, level: schema.exercises.level, images: schema.exercises.images,
    curated: schema.exercises.curated, source: schema.exercises.source, category: schema.exercises.category,
    video: sql<boolean>`(${schema.exercises.licensed}->'video'->>'right') is not null`,
  }).from(schema.exercises).where(and(...conds))
    .orderBy(...score, desc(sql`${schema.exercises.source} = 'user'`), desc(sql`${schema.exercises.licensed} is not null`), desc(schema.exercises.curated), asc(schema.exercises.nameTr))
    .limit(f.limit ?? 60)
}

export async function getExercise(userId: string, id: number) {
  const [x] = await db.select().from(schema.exercises).where(and(eq(schema.exercises.id, id), visible(userId))).limit(1)
  if (!x) return null
  const [rec] = await db.select().from(schema.exerciseRecords).where(and(eq(schema.exerciseRecords.userId, userId), eq(schema.exerciseRecords.exerciseId, id))).limit(1)
  const hist = await exerciseHistory(userId, [id], 5)
  return { ...x, records: (rec?.records ?? null) as unknown as Records | null, history: hist.get(id) ?? [] }
}

export async function createCustomExercise(userId: string, i: { name: string; primary: string; equipment: string; kind: ExKind; pattern: string }) {
  const key = 'u-' + crypto.randomUUID()
  const [row] = await db.insert(schema.exercises).values({
    key, source: 'user', userId, nameTr: i.name, category: i.kind === 'distance_time' ? 'cardio' : 'strength', equipment: i.equipment,
    primary: [i.primary], kind: i.kind, pattern: i.pattern, search: normalizeSearch(i.name),
  }).returning({ id: schema.exercises.id })
  return row.id
}

/** Hareket başına son N seans (eskiden yeniye), yalnızca tamamlanmış antrenmanlardan. */
export async function exerciseHistory(userId: string, exerciseIds: number[], perExercise = 6): Promise<Map<number, (Session & { workoutId: string })[]>> {
  const out = new Map<number, (Session & { workoutId: string })[]>()
  if (!exerciseIds.length) return out
  const rows = await db.execute<{ exercise_id: number; workout_id: string; day: string; pain: boolean; sets: { kg: number; reps: number; rir: number | null; type: SetType; seconds: number | null }[]; rn: number }>(sql`
    select * from (
      select s.exercise_id, w.id as workout_id, w.day::text as day, w.pain,
        json_agg(json_build_object('kg', s.kg, 'reps', s.reps, 'rir', s.rir, 'type', s.type, 'seconds', s.seconds) order by s.set_idx) as sets,
        row_number() over (partition by s.exercise_id order by max(s.completed_at) desc) as rn
      from workout_sets s join workouts w on w.id = s.workout_id
      where s.user_id = ${userId} and w.deleted_at is null and s.exercise_id in ${sql.raw('(' + exerciseIds.map(Number).join(',') + ')')}
      group by s.exercise_id, w.id, w.day, w.pain
    ) x where rn <= ${perExercise} order by exercise_id, rn desc`)
  for (const r of rows) {
    const id = Number(r.exercise_id)
    const list = out.get(id) ?? []
    list.push({ day: r.day, sets: r.sets, pain: r.pain, workoutId: r.workout_id })
    out.set(id, list)
  }
  return out
}

/** Reddedilen önerilerin son 10 kaydı (motor bir kademe kaydırır). */
async function feedbackCounts(userId: string, ids: number[]) {
  const out = new Map<number, { tooHeavy: number; tooLight: number }>()
  if (!ids.length) return out
  const rows = await db.execute<{ exercise_id: number; heavy: number; light: number }>(sql`
    select exercise_id, count(*) filter (where feedback = 'too_heavy')::int as heavy, count(*) filter (where feedback = 'too_light')::int as light from (
      select exercise_id, feedback, row_number() over (partition by exercise_id order by completed_at desc) rn from workout_sets
      where user_id = ${userId} and feedback is not null and exercise_id in ${sql.raw('(' + ids.map(Number).join(',') + ')')}
    ) x where rn <= 10 group by exercise_id`)
  for (const r of rows) out.set(Number(r.exercise_id), { tooHeavy: Number(r.heavy), tooLight: Number(r.light) })
  return out
}

// ───────── Programlar ─────────

export async function listPrograms(userId: string) {
  const ps = await db.select().from(schema.programs).where(and(eq(schema.programs.userId, userId), isNull(schema.programs.deletedAt))).orderBy(desc(schema.programs.active), desc(schema.programs.updatedAt))
  if (!ps.length) return []
  const days = await db.select({ programId: schema.programDays.programId, n: sql<number>`count(*)::int` }).from(schema.programDays).where(inArray(schema.programDays.programId, ps.map((p) => p.id))).groupBy(schema.programDays.programId)
  const nd = new Map(days.map((d) => [d.programId, Number(d.n)]))
  return ps.map((p) => ({ ...p, dayCount: nd.get(p.id) ?? 0 }))
}

export async function getProgram(userId: string, id: string) {
  const [p] = await db.select().from(schema.programs).where(and(eq(schema.programs.id, id), eq(schema.programs.userId, userId), isNull(schema.programs.deletedAt))).limit(1)
  if (!p) return null
  const days = await db.select().from(schema.programDays).where(eq(schema.programDays.programId, id)).orderBy(asc(schema.programDays.idx))
  const exs = days.length ? await db.select({
    pe: schema.programExercises, name: schema.exercises.nameTr, kind: schema.exercises.kind, equipment: schema.exercises.equipment, images: schema.exercises.images, primary: schema.exercises.primary, licensed: schema.exercises.licensed,
  }).from(schema.programExercises).innerJoin(schema.exercises, eq(schema.exercises.id, schema.programExercises.exerciseId))
    .where(inArray(schema.programExercises.dayId, days.map((d) => d.id))).orderBy(asc(schema.programExercises.idx)) : []
  return { ...p, days: days.map((d) => ({ ...d, exercises: exs.filter((e) => e.pe.dayId === d.id).map((e) => ({ ...e.pe, name: e.name, kind: e.kind as ExKind, equipment: e.equipment, images: e.images, primary: e.primary, ...exerciseMedia(e.licensed) })) })) }
}

async function keyToId(keys: string[]) {
  const rows = keys.length ? await db.select({ id: schema.exercises.id, key: schema.exercises.key }).from(schema.exercises).where(inArray(schema.exercises.key, keys)) : []
  return new Map(rows.map((r) => [r.key, r.id]))
}

async function equipmentMap() {
  const keys = [...new Set(TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.slots.flatMap((s) => s.alts))))]
  const rows = await db.select({ key: schema.exercises.key, equipment: schema.exercises.equipment }).from(schema.exercises).where(inArray(schema.exercises.key, keys))
  const m = new Map(rows.map((r) => [r.key, r.equipment]))
  return (k: string) => m.get(k) ?? 'missing'
}

export async function insertProgram(userId: string, name: string, templateId: string | null, days: ProgramDay[], notes: string[], activate: boolean) {
  const ids = await keyToId([...new Set(days.flatMap((d) => d.exercises.map((e) => e.key)))])
  return db.transaction(async (tx) => {
    if (activate) await tx.update(schema.programs).set({ active: false }).where(eq(schema.programs.userId, userId))
    const [p] = await tx.insert(schema.programs).values({ userId, name, templateId, notes, active: activate }).returning({ id: schema.programs.id })
    for (const [i, d] of days.entries()) {
      const [day] = await tx.insert(schema.programDays).values({ programId: p.id, idx: i, name: d.name, focus: d.focus }).returning({ id: schema.programDays.id })
      const rows = d.exercises.filter((e) => ids.has(e.key)).map((e, j) => ({
        dayId: day.id, idx: j, exerciseId: ids.get(e.key)!, role: e.role, sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds ?? null, setType: e.type ?? 'normal', scheme: e.scheme ?? null,
      }))
      if (rows.length) await tx.insert(schema.programExercises).values(rows)
    }
    return p.id
  })
}

export async function createFromTemplate(userId: string, templateId: string) {
  const t = TEMPLATES.find((x) => x.id === templateId)
  if (!t) throw new Error('Şablon yok')
  const gym = await ensureGym(userId)
  const days = instantiate(t, await equipmentMap(), new Set(gym.equipment))
  const has = (await listPrograms(userId)).some((p) => p.active)
  return insertProgram(userId, t.name, t.id, days, [], !has)
}

export async function createGenerated(userId: string, i: { days: number; minutes: number; equipment: string[] }) {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const goal = await activeGoal(userId)
  await db.update(schema.gymSettings).set({ equipment: i.equipment, sessionMinutes: i.minutes, updatedAt: new Date() }).where(eq(schema.gymSettings.userId, userId))
  const g = generateProgram({
    days: i.days, minutes: i.minutes, available: new Set(i.equipment), equipmentOf: await equipmentMap(),
    experience: (profile?.experience as 'new' | 'mid' | 'adv' | null) ?? null, goal: (goal?.type as 'lose' | 'gain' | 'recomp') ?? 'recomp',
  })
  return insertProgram(userId, g.name, 'generated', g.days, g.notes, true)
}

export async function createEmptyProgram(userId: string, name: string) {
  const has = (await listPrograms(userId)).some((p) => p.active)
  return insertProgram(userId, name, null, [{ name: 'Gün 1', focus: '', exercises: [] }], [], !has)
}

export async function copyProgram(userId: string, id: string) {
  const p = await getProgram(userId, id)
  if (!p) throw new Error('Program yok')
  return db.transaction(async (tx) => {
    const [n] = await tx.insert(schema.programs).values({ userId, name: p.name + ' (kopya)', templateId: p.templateId, notes: p.notes, active: false }).returning({ id: schema.programs.id })
    for (const d of p.days) {
      const [day] = await tx.insert(schema.programDays).values({ programId: n.id, idx: d.idx, name: d.name, focus: d.focus }).returning({ id: schema.programDays.id })
      if (d.exercises.length) await tx.insert(schema.programExercises).values(d.exercises.map((e) => ({ dayId: day.id, idx: e.idx, exerciseId: e.exerciseId, role: e.role, sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds, setType: e.setType, scheme: e.scheme, schemeState: e.schemeState })))
    }
    return n.id
  })
}

async function ownsDay(userId: string, dayId: string) {
  const [r] = await db.select({ id: schema.programDays.id, programId: schema.programDays.programId }).from(schema.programDays)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programDays.programId))
    .where(and(eq(schema.programDays.id, dayId), eq(schema.programs.userId, userId), isNull(schema.programs.deletedAt))).limit(1)
  return r ?? null
}
async function ownsProgramExercise(userId: string, peId: string) {
  const [r] = await db.select({ id: schema.programExercises.id, dayId: schema.programExercises.dayId }).from(schema.programExercises)
    .innerJoin(schema.programDays, eq(schema.programDays.id, schema.programExercises.dayId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programDays.programId))
    .where(and(eq(schema.programExercises.id, peId), eq(schema.programs.userId, userId))).limit(1)
  return r ?? null
}
const touch = (programId: string) => db.update(schema.programs).set({ updatedAt: new Date() }).where(eq(schema.programs.id, programId))

export async function addDay(userId: string, programId: string, name: string) {
  const p = await getProgram(userId, programId)
  if (!p) throw new Error('Program yok')
  await db.insert(schema.programDays).values({ programId, idx: p.days.length, name, focus: '' })
  await touch(programId)
}
/** Programdan gün siler: hareketleri silinir (cascade), geçmiş antrenmanlar korunur (program_day_id → null); sıra yeniden numaralanır. */
export async function removeDay(userId: string, dayId: string) {
  const d = await ownsDay(userId, dayId)
  if (!d) throw new Error('Gün yok')
  await db.transaction(async (tx) => {
    const [p] = await tx.select({ nextDayIdx: schema.programs.nextDayIdx }).from(schema.programs).where(eq(schema.programs.id, d.programId)).limit(1)
    const days = await tx.select({ id: schema.programDays.id }).from(schema.programDays).where(eq(schema.programDays.programId, d.programId)).orderBy(asc(schema.programDays.idx))
    const at = days.findIndex((x) => x.id === dayId)
    await tx.delete(schema.programDays).where(eq(schema.programDays.id, dayId))
    const rest = days.filter((x) => x.id !== dayId)
    for (let i = 0; i < rest.length; i++) await tx.update(schema.programDays).set({ idx: i }).where(eq(schema.programDays.id, rest[i].id))
    const n = rest.length
    const cur = p ? p.nextDayIdx % Math.max(1, days.length) : 0
    const next = n ? (cur > at ? cur - 1 : cur === at ? at % n : cur) : 0
    await tx.update(schema.programs).set({ nextDayIdx: next, updatedAt: new Date() }).where(eq(schema.programs.id, d.programId))
  })
}
export async function addExerciseToDay(userId: string, dayId: string, exerciseId: number) {
  const d = await ownsDay(userId, dayId)
  if (!d) throw new Error('Gün yok')
  const [x] = await db.select({ kind: schema.exercises.kind }).from(schema.exercises).where(and(eq(schema.exercises.id, exerciseId), visible(userId))).limit(1)
  if (!x) throw new Error('Hareket yok')
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.programExercises).where(eq(schema.programExercises.dayId, dayId))
  const time = x.kind === 'time'
  await db.insert(schema.programExercises).values({ dayId, idx: Number(n), exerciseId, sets: 3, repMin: time ? 1 : 8, repMax: time ? 1 : 12, rir: 2, rest: 90, seconds: time ? 45 : null })
  await touch(d.programId)
}
export async function updateProgramExercise(userId: string, peId: string, v: { sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null; setType: string }) {
  const r = await ownsProgramExercise(userId, peId)
  if (!r) throw new Error('Kayıt yok')
  await db.update(schema.programExercises).set(v).where(eq(schema.programExercises.id, peId))
}
export async function removeProgramExercise(userId: string, peId: string) {
  const r = await ownsProgramExercise(userId, peId)
  if (!r) throw new Error('Kayıt yok')
  await db.delete(schema.programExercises).where(eq(schema.programExercises.id, peId))
}
export async function setActiveProgram(userId: string, id: string) {
  await db.transaction(async (tx) => {
    await tx.update(schema.programs).set({ active: false }).where(eq(schema.programs.userId, userId))
    await tx.update(schema.programs).set({ active: true, updatedAt: new Date() }).where(and(eq(schema.programs.id, id), eq(schema.programs.userId, userId)))
  })
}
export async function deleteProgram(userId: string, id: string) {
  await db.update(schema.programs).set({ deletedAt: new Date(), active: false }).where(and(eq(schema.programs.id, id), eq(schema.programs.userId, userId)))
}

// ───────── Canlı antrenman ─────────

export interface LiveExercise {
  exerciseId: number; name: string; kind: ExKind; equipment: string; images: string[]; primary: string[]
  /** Faz 5h-3: lisanslı küçük resim ve video (yoksa null) */
  thumb?: string | null; video?: string | null
  sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null; setType: SetType
  history: Session[]; records: Records | null; feedback: { tooHeavy: number; tooLight: number }
  /** Faz 3b: GZCLP kademesi (ağırlık ve setler sabit), periyodizasyon etiketi, plato notu */
  scheme?: { label: string; sets: { kg: number; reps: number; amrap: boolean }[] } | null
  period?: { label: string; loadPct: number; deload: boolean } | null
  plateau?: { weeks: number; tip: string } | null
}

/** Canlı mod verisi: hedefler + her hareketin geçmişi (öneri istemcide lib/training.ts ile hesaplanır, çevrimdışı da çalışır). */
export async function liveSession(userId: string, programDayId: string | null, extraExerciseIds: number[] = []) {
  const gym = await ensureGym(userId)
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const goal = await activeGoal(userId)
  let name = 'Serbest antrenman'
  let meta: { periodization: Periodization; deloadEvery: number; startDay: string } | null = null
  type Row = Omit<LiveExercise, 'history' | 'records' | 'feedback'> & { schemeKey?: string | null; schemeState?: GzState | null }
  let rows: Row[] = []
  if (programDayId) {
    const d = await ownsDay(userId, programDayId)
    if (d) {
      const p = await getProgram(userId, d.programId)
      const day = p?.days.find((x) => x.id === programDayId)
      if (day) {
        name = day.name
        meta = { periodization: p!.periodization as Periodization, deloadEvery: p!.deloadEvery, startDay: p!.startDay }
        rows = day.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, kind: e.kind, equipment: e.equipment, images: e.images, primary: e.primary, thumb: e.thumb, video: e.video, sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds, setType: e.setType as SetType, schemeKey: e.scheme, schemeState: e.schemeState }))
      }
    }
  }
  if (extraExerciseIds.length) {
    const xs = await db.select().from(schema.exercises).where(and(inArray(schema.exercises.id, extraExerciseIds), visible(userId)))
    for (const x of xs) if (!rows.some((r) => r.exerciseId === x.id)) rows.push({ exerciseId: x.id, name: x.nameTr, kind: x.kind as ExKind, equipment: x.equipment, images: x.images, primary: x.primary, ...exerciseMedia(x.licensed), sets: 3, repMin: x.kind === 'time' ? 1 : 8, repMax: x.kind === 'time' ? 1 : 12, rir: 2, rest: 90, seconds: x.kind === 'time' ? 45 : null, setType: 'normal' })
  }
  const ids = rows.map((r) => r.exerciseId)
  const [hist, recs, fb] = await Promise.all([
    exerciseHistory(userId, ids),
    ids.length ? db.select().from(schema.exerciseRecords).where(and(eq(schema.exerciseRecords.userId, userId), inArray(schema.exerciseRecords.exerciseId, ids))) : Promise.resolve([]),
    feedbackCounts(userId, ids),
  ])
  const recBy = new Map(recs.map((r) => [r.exerciseId, r.records as unknown as Records]))
  const today = dayString()
  const week = meta ? weekIndex(meta.startDay, today) : 0
  const TIER_LABEL: Record<Tier, string> = { t1: 'T1', t2: 'T2', t3: 'T3' }
  const exercises = rows.map(({ schemeKey, schemeState, ...r }) => {
    const history = hist.get(r.exerciseId) ?? []
    const out: LiveExercise = { ...r, history, records: recBy.get(r.exerciseId) ?? null, feedback: fb.get(r.exerciseId) ?? { tooHeavy: 0, tooLight: 0 }, scheme: null, period: null, plateau: null }
    if (schemeKey?.startsWith('gzclp-')) {
      const tier = schemeKey.slice(6) as Tier
      if (schemeState) {
        const sets = gzSets(schemeState)
        out.scheme = { label: `GZCLP ${TIER_LABEL[tier]} · ${sets.length}×${sets[0].reps}${sets.some((x) => x.amrap) ? '+' : ''}`, sets }
        out.sets = sets.length; out.repMin = out.repMax = sets[0].reps
      } else out.scheme = { label: `GZCLP ${TIER_LABEL[tier]} · ilk seans: çalışma ağırlığını belirle`, sets: [] }
    } else if (meta) {
      const t = periodTarget({ scheme: meta.periodization, week, session: history.length, base: { sets: r.sets, repMin: r.repMin, repMax: r.repMax, rir: r.rir }, deloadEvery: meta.deloadEvery })
      out.sets = t.sets; out.repMin = t.repMin; out.repMax = t.repMax; out.rir = t.rir
      if (meta.periodization !== 'linear' || t.deload) out.period = { label: t.label, loadPct: t.loadPct, deload: t.deload }
    }
    const series = history.map((h) => ({ day: h.day, e1rm: Math.max(0, ...h.sets.filter((x) => x.type !== 'warmup').map((x) => e1rmOf(x))) }))
    const pl = detectPlateau(series, today, { repMin: r.repMin, repMax: r.repMax })
    if (pl.plateau) out.plateau = { weeks: pl.weeks, tip: pl.suggestions[1] }
    return out
  })
  // antrenman öncesi yakıt: bugün hedefin %30'undan az yendiyse ve son 4 saatte öğün yoksa uyarı
  const eaten = await dayMacros(userId, today)
  const [lastMeal] = await db.select({ at: schema.mealItems.loggedAt }).from(schema.mealItems).where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.day, today), isNull(schema.mealItems.deletedAt), sql`not (${schema.mealItems.meal} = 'supplement' and ${schema.mealItems.kcal} < 50)`)).orderBy(desc(schema.mealItems.loggedAt)).limit(1)
  const target = goal?.dailyKcal ?? 2000
  const nowMin = minuteOfDay(new Date())
  const fuel = eaten.kcal < target * 0.3 && (!lastMeal || Date.now() - lastMeal.at.getTime() > 4 * 3600_000) && nowMin >= 6 * 60
    ? `Bugün ${Math.round(eaten.kcal)} kcal yedin${lastMeal ? ', son öğün 4 saatten önce' : ''}. Antrenmandan 1–2 saat önce karbonhidrat + protein içeren hafif bir öğün performansı artırır.` : null
  return {
    name, programDayId, bodyKg: profile?.weightKg ?? 70, deficitKcal: goal ? Math.max(0, goal.tdee - goal.dailyKcal) : 0,
    gym: { barKg: gym.barKg, plates: gym.plates, increment: gym.increment }, week: meta ? week + 1 : null, periodization: meta?.periodization ?? null, fuel,
    exercises,
  }
}

export interface WorkoutPayload {
  clientId: string; programDayId: string | null; name: string; startedAt: string; endedAt: string; notes: string | null; pain: boolean
  exercises: { exerciseId: number; sets: (LoggedSet & { completedAt: string; suggestedKg: number | null; suggestedReps: number | null; feedback: string | null; distanceM?: number | null })[] }[]
}

/** Antrenmanı kaydeder (client_id ile idempotent), rekorları günceller, olayları yayınlar, programı ilerletir. */
export async function saveWorkout(userId: string, p: WorkoutPayload) {
  // istemcinin bildirdiği program günü bu kullanıcıya ait değilse yok sayılır (başkasının programı ilerletilemez)
  if (p.programDayId && !(await ownsDay(userId, p.programDayId))) p = { ...p, programDayId: null }
  const [dup] = await db.select({ id: schema.workouts.id }).from(schema.workouts).where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.clientId, p.clientId))).limit(1)
  if (dup) return { id: dup.id, duplicate: true, prs: [] as { exerciseId: number; type: string; value: number; previous: number }[] }
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const bodyKg = profile?.weightKg ?? 70
  const ids = p.exercises.map((e) => e.exerciseId)
  const xs = ids.length ? await db.select({ id: schema.exercises.id, kind: schema.exercises.kind }).from(schema.exercises).where(and(inArray(schema.exercises.id, ids), visible(userId))) : []
  const kind = new Map(xs.map((x) => [x.id, x.kind as ExKind]))
  const exs = p.exercises.filter((e) => kind.has(e.exerciseId) && e.sets.length)
  const started = new Date(p.startedAt), ended = new Date(p.endedAt)
  const durationSec = Math.max(60, Math.min(6 * 3600, Math.round((ended.getTime() - started.getTime()) / 1000)))
  const workSets = exs.reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup').length, 0)
  const volume = Math.round(exs.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s, kind.get(e.exerciseId)!, bodyKg), 0), 0))
  const kcal = strengthKcal(durationSec / 60, bodyKg, workSets)
  const day = dayString(started)
  const prevRecs = ids.length ? await db.select().from(schema.exerciseRecords).where(and(eq(schema.exerciseRecords.userId, userId), inArray(schema.exerciseRecords.exerciseId, ids))) : []
  const prevBy = new Map(prevRecs.map((r) => [r.exerciseId, r.records as unknown as Records]))
  const prs: { exerciseId: number; type: string; value: number; previous: number; suspect?: string | null }[] = []
  // PR doğrulama (Faz 5b): 7 gün önceki en iyi set (kg ve e1RM) ve vücut ağırlığı oranı
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const old7 = ids.length ? await db.select({ exerciseId: schema.workoutSets.exerciseId, kg: schema.workoutSets.kg, reps: schema.workoutSets.reps, rir: schema.workoutSets.rir }).from(schema.workoutSets)
    .where(and(eq(schema.workoutSets.userId, userId), inArray(schema.workoutSets.exerciseId, ids), sql`${schema.workoutSets.completedAt} <= ${weekAgo.toISOString()}`, sql`${schema.workoutSets.type} <> 'warmup'`)) : []
  const keyOf = new Map((ids.length ? await db.select({ id: schema.exercises.id, key: schema.exercises.key }).from(schema.exercises).where(inArray(schema.exercises.id, ids)) : []).map((r) => [r.id, r.key]))
  const best7 = (exId: number, type: string) => {
    const xs = old7.filter((x) => x.exerciseId === exId)
    if (!xs.length) return null
    return type === 'kg' ? Math.max(...xs.map((x) => x.kg)) : Math.max(...xs.map((x) => e1rm(x.kg, x.reps, x.rir)))
  }

  const id = await db.transaction(async (tx) => {
    const [w] = await tx.insert(schema.workouts).values({
      userId, clientId: p.clientId, programDayId: p.programDayId, name: p.name.slice(0, 80), day, startedAt: started, endedAt: ended, durationSec,
      volumeKg: volume, workSets, kcalGross: kcal.gross, kcalNet: kcal.net, bodyKg, notes: p.notes?.slice(0, 500) || null, pain: p.pain,
    }).onConflictDoNothing().returning({ id: schema.workouts.id })
    if (!w) return null
    for (const [ei, e] of exs.entries()) {
      const k = kind.get(e.exerciseId)!
      await tx.insert(schema.workoutSets).values(e.sets.map((s, si) => ({
        workoutId: w.id, userId, exerciseId: e.exerciseId, exIdx: ei, setIdx: si, type: s.type, kg: s.kg, reps: s.reps, rir: s.rir, seconds: s.seconds ?? null,
        distanceM: s.distanceM ?? null, suggestedKg: s.suggestedKg, suggestedReps: s.suggestedReps, feedback: s.feedback, completedAt: new Date(s.completedAt),
      })))
      const cur = sessionRecords(e.sets, k, bodyKg)
      const prev = prevBy.get(e.exerciseId) ?? null
      for (const pr of detectPRs(prev, cur, k)) prs.push({ exerciseId: e.exerciseId, ...pr })
      const merged = mergeRecords(prev, cur)
      await tx.insert(schema.exerciseRecords).values({ userId, exerciseId: e.exerciseId, records: merged as unknown as Record<string, number> })
        .onConflictDoUpdate({ target: [schema.exerciseRecords.userId, schema.exerciseRecords.exerciseId], set: { records: merged as unknown as Record<string, number>, updatedAt: new Date() } })
    }
    for (const r of prs) r.suspect = prSuspicious({ type: r.type, value: r.value, best7dAgo: best7(r.exerciseId, r.type === 'kg' ? 'kg' : 'e1rm'), exerciseKey: keyOf.get(r.exerciseId) ?? '', bodyKg, sex: (profile?.sex as 'male' | 'female') ?? 'male' })
    if (prs.length) await tx.insert(schema.personalRecords).values(prs.map((r) => ({ userId, exerciseId: r.exerciseId, workoutId: w.id, type: r.type, value: r.value, previous: r.previous, suspect: r.suspect ?? null })))
    if (p.programDayId) {
      const [d] = await tx.select({ programId: schema.programDays.programId, idx: schema.programDays.idx }).from(schema.programDays).where(eq(schema.programDays.id, p.programDayId)).limit(1)
      if (d) {
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.programDays).where(eq(schema.programDays.programId, d.programId))
        await tx.update(schema.programs).set({ nextDayIdx: (d.idx + 1) % Math.max(1, Number(n)), updatedAt: new Date() }).where(and(eq(schema.programs.id, d.programId), eq(schema.programs.userId, userId)))
      }
    }
    return w.id
  })
  if (!id) { const [d2] = await db.select({ id: schema.workouts.id }).from(schema.workouts).where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.clientId, p.clientId))).limit(1); return { id: d2.id, duplicate: true, prs: [] } }
  if (p.programDayId) await advanceSchemes(userId, p.programDayId, exs)
  await publish(userId, 'workout.finished', { id, kind: 'strength', day, minutes: Math.round(durationSec / 60), kcalNet: kcal.net, volume, workSets })
  for (const pr of prs) await publish(userId, 'pr.achieved', { workoutId: id, ...pr })
  await refreshClosedDay(userId, day)
  return { id, duplicate: false, prs }
}

/** GZCLP: seans sonrası kademe/ağırlık durumunu ilerletir. İlk seansta durum, yapılan çalışma ağırlığından başlar. */
async function advanceSchemes(userId: string, dayId: string, exs: { exerciseId: number; sets: LoggedSet[] }[]) {
  if (!(await ownsDay(userId, dayId))) return
  const pes = await db.select({ pe: schema.programExercises, pattern: schema.exercises.pattern }).from(schema.programExercises)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.programExercises.exerciseId))
    .where(and(eq(schema.programExercises.dayId, dayId), sql`${schema.programExercises.scheme} like 'gzclp-%'`))
  const gym = await ensureGym(userId)
  for (const { pe, pattern } of pes) {
    const e = exs.find((x) => x.exerciseId === pe.exerciseId)
    const work = e?.sets.filter((x) => x.type !== 'warmup' && x.reps > 0) ?? []
    if (!work.length) continue
    const tier = pe.scheme!.slice(6) as Tier
    const state: GzState = pe.schemeState ?? { tier, stage: 0, kg: Math.max(...work.map((x) => x.kg)), lastBaseKg: null }
    const r = gzAdvance(state, work.map((x) => ({ kg: x.kg, reps: x.reps })), pattern === 'legs', gym.increment)
    await db.update(schema.programExercises).set({ schemeState: r.next }).where(eq(schema.programExercises.id, pe.id))
  }
}

export async function workoutSummary(userId: string, id: string) {
  const [w] = await db.select().from(schema.workouts).where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt))).limit(1)
  if (!w) return null
  const sets = await db.select({ s: schema.workoutSets, name: schema.exercises.nameTr, kind: schema.exercises.kind, primary: schema.exercises.primary })
    .from(schema.workoutSets).innerJoin(schema.exercises, eq(schema.exercises.id, schema.workoutSets.exerciseId))
    .where(eq(schema.workoutSets.workoutId, id)).orderBy(asc(schema.workoutSets.exIdx), asc(schema.workoutSets.setIdx))
  const prs = await db.select({ pr: schema.personalRecords, name: schema.exercises.nameTr }).from(schema.personalRecords)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId)).where(eq(schema.personalRecords.workoutId, id))
  const muscles = new Map<string, number>()
  for (const x of sets) if (x.s.type !== 'warmup') for (const m of x.primary) muscles.set(m, (muscles.get(m) ?? 0) + 1)
  const exercises: { exerciseId: number; name: string; kind: string; sets: (typeof sets)[number]['s'][] }[] = []
  for (const x of sets) {
    let e = exercises.find((y) => y.exerciseId === x.s.exerciseId)
    if (!e) { e = { exerciseId: x.s.exerciseId, name: x.name, kind: x.kind, sets: [] }; exercises.push(e) }
    e.sets.push(x.s)
  }
  const [prev] = w.programDayId ? await db.select().from(schema.workouts).where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.programDayId, w.programDayId), isNull(schema.workouts.deletedAt), sql`${schema.workouts.startedAt} < ${w.startedAt.toISOString()}`)).orderBy(desc(schema.workouts.startedAt)).limit(1) : [undefined]
  return {
    workout: w, exercises, prs: prs.map((p) => ({ ...p.pr, name: p.name })),
    muscles: [...muscles.entries()].sort((a, b) => b[1] - a[1]),
    previous: prev ? { day: prev.day, volumeKg: prev.volumeKg, durationSec: prev.durationSec, workSets: prev.workSets } : null,
  }
}

export async function recentWorkouts(userId: string, limit = 10) {
  return db.select().from(schema.workouts).where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt))).orderBy(desc(schema.workouts.startedAt)).limit(limit)
}

export async function deleteWorkout(userId: string, id: string) {
  const [w] = await db.update(schema.workouts).set({ deletedAt: new Date() }).where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt))).returning({ day: schema.workouts.day })
  if (w) await refreshClosedDay(userId, w.day)
  return !!w
}

// ───────── Kardiyo ─────────

export async function logCardio(userId: string, i: { type: CardioType; minutes: number; distanceKm: number | null; avgHr: number | null; intensity: Intensity; day: string; note: string | null }) {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const k = cardioKcal({ type: i.type, minutes: i.minutes, weightKg: profile?.weightKg ?? 70, intensity: i.intensity, distanceKm: i.distanceKm, avgHr: i.avgHr, sex: (profile?.sex as Sex) ?? undefined, age: profile ? ageFromBirthDate(profile.birthDate) : undefined })
  const [row] = await db.insert(schema.cardioSessions).values({ userId, day: i.day, type: i.type, minutes: i.minutes, distanceKm: i.distanceKm, avgHr: i.avgHr, intensity: i.intensity, kcalGross: k.gross, kcalNet: k.net, method: k.method, note: i.note }).returning({ id: schema.cardioSessions.id })
  await publish(userId, 'workout.finished', { id: row.id, kind: 'cardio', day: i.day, minutes: i.minutes, kcalNet: k.net })
  await refreshClosedDay(userId, i.day)
  return { id: row.id, ...k }
}

export async function recentCardio(userId: string, limit = 10) {
  return db.select().from(schema.cardioSessions).where(and(eq(schema.cardioSessions.userId, userId), isNull(schema.cardioSessions.deletedAt))).orderBy(desc(schema.cardioSessions.createdAt)).limit(limit)
}
export async function deleteCardio(userId: string, id: string) {
  const [c] = await db.update(schema.cardioSessions).set({ deletedAt: new Date() }).where(and(eq(schema.cardioSessions.id, id), eq(schema.cardioSessions.userId, userId), isNull(schema.cardioSessions.deletedAt))).returning({ day: schema.cardioSessions.day })
  if (c) await refreshClosedDay(userId, c.day)
}

/** Fitness ana ekranı: aktif program ve sıradaki gün, bu haftanın antrenmanları, son rekorlar. */
export async function fitnessHome(userId: string) {
  await ensureGym(userId)
  const progs = await listPrograms(userId)
  const active = progs.find((p) => p.active)
  const program = active ? await getProgram(userId, active.id) : null
  const next = program?.days.length ? program.days[program.nextDayIdx % program.days.length] : null
  const today = dayString()
  const dow = new Date(today + 'T12:00:00Z').getUTCDay()
  const monday = addDays(today, -((dow + 6) % 7))
  const [week, recent, prs, cardio, [cardioWeek], [profile]] = await Promise.all([
    db.select({ day: schema.workouts.day, n: sql<number>`count(*)::int`, min: sql<number>`sum(duration_sec)/60`, vol: sql<number>`coalesce(sum(volume_kg),0)` }).from(schema.workouts)
      .where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt), sql`${schema.workouts.day} >= ${monday}`)).groupBy(schema.workouts.day),
    recentWorkouts(userId, 5),
    db.select({ pr: schema.personalRecords, name: schema.exercises.nameTr }).from(schema.personalRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId))
      .where(eq(schema.personalRecords.userId, userId)).orderBy(desc(schema.personalRecords.createdAt)).limit(5),
    recentCardio(userId, 3),
    db.select({ min: sql<number>`coalesce(sum(minutes),0)` }).from(schema.cardioSessions).where(and(eq(schema.cardioSessions.userId, userId), isNull(schema.cardioSessions.deletedAt), sql`${schema.cardioSessions.day} >= ${monday}`)),
    db.select({ trainingDays: schema.profiles.trainingDays }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
  ])
  return { programs: progs, program, next, week: week.map((w) => ({ day: w.day, n: Number(w.n), min: Number(w.min), vol: Number(w.vol) })), cardioWeekMin: Math.round(Number(cardioWeek?.min ?? 0)), monday, today, recent, prs: prs.map((p) => ({ ...p.pr, name: p.name })), cardio, trainingDays: profile?.trainingDays ?? null }
}

/** Bugün ekranı antrenman kartı. */
export async function todayTraining(userId: string, day: string) {
  const [w] = await db.select({ n: sql<number>`count(*)::int`, min: sql<number>`coalesce(sum(duration_sec),0)/60`, kcal: sql<number>`coalesce(sum(kcal_net),0)` }).from(schema.workouts).where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.day, day), isNull(schema.workouts.deletedAt)))
  const [c] = await db.select({ n: sql<number>`count(*)::int`, min: sql<number>`coalesce(sum(minutes),0)` }).from(schema.cardioSessions).where(and(eq(schema.cardioSessions.userId, userId), eq(schema.cardioSessions.day, day), isNull(schema.cardioSessions.deletedAt)))
  const [p] = await db.select({ id: schema.programs.id, nextDayIdx: schema.programs.nextDayIdx }).from(schema.programs).where(and(eq(schema.programs.userId, userId), eq(schema.programs.active, true), isNull(schema.programs.deletedAt))).limit(1)
  let next: { id: string; name: string } | null = null
  if (p) {
    const days = await db.select({ id: schema.programDays.id, name: schema.programDays.name }).from(schema.programDays).where(eq(schema.programDays.programId, p.id)).orderBy(asc(schema.programDays.idx))
    if (days.length) next = days[p.nextDayIdx % days.length]
  }
  return { workouts: Number(w?.n ?? 0), minutes: Math.round(Number(w?.min ?? 0)) + Math.round(Number(c?.min ?? 0)), cardio: Number(c?.n ?? 0), next }
}

// ───────── Faz 3b: program ayarları ─────────
export async function updateProgramSettings(userId: string, id: string, v: { periodization: Periodization; deloadEvery: number }) {
  const r = await db.update(schema.programs).set({ ...v, updatedAt: new Date() }).where(and(eq(schema.programs.id, id), eq(schema.programs.userId, userId), isNull(schema.programs.deletedAt))).returning({ id: schema.programs.id })
  if (!r.length) throw new Error('Program yok')
}
/** GZCLP çalışma ağırlığını elle düzelt (kademe korunur; durum yoksa kademe 1'den başlar). */
export async function setSchemeKg(userId: string, peId: string, kg: number) {
  const r = await ownsProgramExercise(userId, peId)
  if (!r) throw new Error('Kayıt yok')
  const [pe] = await db.select().from(schema.programExercises).where(eq(schema.programExercises.id, peId)).limit(1)
  if (!pe?.scheme?.startsWith('gzclp-')) throw new Error('Bu hareket GZCLP değil')
  const tier = pe.scheme.slice(6) as Tier
  await db.update(schema.programExercises).set({ schemeState: { ...(pe.schemeState ?? { tier, stage: 0, lastBaseKg: null }), kg } }).where(eq(schema.programExercises.id, peId))
}
