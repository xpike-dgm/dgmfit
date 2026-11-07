'use server'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { addDays, dayString } from '@/lib/time'
import { TEMPLATES, ALL_EQUIPMENT } from '@/lib/programs'
import { CARDIO, CARDIO_MAX_KMH, SET_TYPES } from '@/lib/training'
import {
  addDay, addExerciseToDay, copyProgram, createFromAgProgram, linkSuperset, createCustomExercise, createEmptyProgram, createFromTemplate, createGenerated, deleteCardio,
  deleteProgram, deleteWorkout, ensureGym, liveSession, logCardio, removeProgramExercise, saveWorkout, setActiveProgram, updateProgramExercise,
  setSchemeKg, updateProgramSettings,
  type LiveExercise, removeDay } from '@/lib/fitness-data'
import { addMeasurement, alternativesFor, deleteMeasurement, MEASURES } from '@/lib/fitness-stats'
import { deleteMedia } from '@/lib/media'
import { createAiProgram } from '@/lib/planner-data'
import { AiError } from '@/lib/ai/engine'
import { MUSCLES } from '@/lib/exercise-labels'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const Uuid = z.string().uuid()

async function uid() {
  const u = await getUser()
  if (!u) throw new Error('Oturum yok')
  return u.id
}
const refresh = () => { revalidatePath('/fitness', 'layout'); revalidatePath('/'); revalidatePath('/fit'); revalidatePath('/su') }
async function run<T extends object>(fn: () => Promise<T>): Promise<R<T>> {
  try { const r = await fn(); refresh(); return { ok: true, ...r } } catch (e) { return { ok: false, error: (e as Error).message || 'Bir hata oldu' } }
}

export async function createFromAgProgramAction(id: string): Promise<R<{ id: string }>> {
  const userId = await uid()
  if (!/^ag-[0-9a-f-]{36}$/.test(id)) return { ok: false, error: 'Şablon yok' }
  return run(async () => ({ id: await createFromAgProgram(userId, id) }))
}
export async function createFromTemplateAction(templateId: string): Promise<R<{ id: string }>> {
  const userId = await uid()
  if (!TEMPLATES.some((t) => t.id === templateId)) return { ok: false, error: 'Şablon yok' }
  return run(async () => ({ id: await createFromTemplate(userId, templateId) }))
}

const GenInput = z.object({ days: z.number().int().min(2).max(6), minutes: z.number().int().min(20).max(150), equipment: z.array(z.enum(ALL_EQUIPMENT)).min(1), priority: z.array(z.enum(['chest', 'shoulders', 'lats', 'middle back', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'])).max(4).optional() })
export async function createGeneratedAction(input: z.input<typeof GenInput>): Promise<R<{ id: string }>> {
  const userId = await uid()
  const p = GenInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Gün 2–6, süre 20–150 dk ve en az bir ekipman seç' }
  return run(async () => ({ id: await createGenerated(userId, p.data) }))
}

const AiProgIn = z.object({ days: z.number().int().min(2).max(6), minutes: z.number().int().min(20).max(150), equipment: z.array(z.enum(ALL_EQUIPMENT)).min(1), weak: z.array(z.string().max(30)).max(6), note: z.string().trim().max(200) })
/** AI program oluşturucu: dil modeli + kural denetimi (lib/ai-program.ts). Kullanıcının günlük AI hakkına sayılır. */
export async function createAiProgramAction(input: z.input<typeof AiProgIn>): Promise<R<{ id: string; warnings: string[] }>> {
  const userId = await uid()
  const p = AiProgIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Gün 2–6, süre 20–150 dk ve en az bir ekipman seç' }
  try {
    const r = await createAiProgram(userId, { ...p.data, weak: p.data.weak.filter((m) => m in MUSCLES) })
    refresh()
    return { ok: true, id: r.id, warnings: r.warnings }
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message }
    console.error('[dgfit] AI program', e)
    return { ok: false, error: 'AI programı oluşturulamadı. Biraz sonra tekrar dene.' }
  }
}

export async function createEmptyProgramAction(name: string): Promise<R<{ id: string }>> {
  const userId = await uid()
  const n = z.string().trim().min(1).max(60).safeParse(name)
  if (!n.success) return { ok: false, error: 'Program adı 1–60 karakter olmalı' }
  return run(async () => ({ id: await createEmptyProgram(userId, n.data) }))
}

export async function copyProgramAction(id: string): Promise<R<{ id: string }>> {
  const userId = await uid()
  if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => ({ id: await copyProgram(userId, id) }))
}
export async function setActiveProgramAction(id: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await setActiveProgram(userId, id); return {} })
}
export async function deleteProgramAction(id: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await deleteProgram(userId, id); return {} })
}
export async function addDayAction(programId: string, name: string): Promise<R> {
  const userId = await uid()
  const n = z.string().trim().min(1).max(40).safeParse(name)
  if (!Uuid.safeParse(programId).success || !n.success) return { ok: false, error: 'Gün adı 1–40 karakter olmalı' }
  return run(async () => { await addDay(userId, programId, n.data); return {} })
}
export async function removeDayAction(dayId: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(dayId).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await removeDay(userId, dayId); return {} })
}
export async function addExerciseToDayAction(dayId: string, exerciseId: number): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(dayId).success || !Number.isInteger(exerciseId)) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await addExerciseToDay(userId, dayId, exerciseId); return {} })
}

const setTypes = Object.keys(SET_TYPES) as [string, ...string[]]
const PeInput = z.object({
  sets: z.number().int().min(1).max(10), repMin: z.number().int().min(1).max(50), repMax: z.number().int().min(1).max(50), rir: z.number().int().min(0).max(4),
  rest: z.number().int().min(15).max(600), seconds: z.number().int().min(5).max(900).nullable(), setType: z.enum(setTypes),
}).refine((v) => v.repMax >= v.repMin, 'Üst tekrar alt tekrardan küçük olamaz')
export async function updateProgramExerciseAction(peId: string, input: z.input<typeof PeInput>): Promise<R> {
  const userId = await uid()
  const p = PeInput.safeParse(input)
  if (!Uuid.safeParse(peId).success || !p.success) return { ok: false, error: p.success ? 'Geçersiz' : p.error.issues[0]?.message ?? 'Geçersiz değer' }
  return run(async () => { await updateProgramExercise(userId, peId, p.data); return {} })
}
export async function linkSupersetAction(peId: string, withNext: boolean): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(peId).success || typeof withNext !== 'boolean') return { ok: false, error: 'Geçersiz' }
  return run(async () => { await linkSuperset(userId, peId, withNext); return {} })
}
export async function removeProgramExerciseAction(peId: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(peId).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await removeProgramExercise(userId, peId); return {} })
}

const SetIn = z.object({
  kg: z.number().min(0).max(1000), reps: z.number().int().min(0).max(500), rir: z.number().min(0).max(10).refine((v) => Number.isInteger(v * 2), 'RIR yarım adımlı olmalı').nullable(), type: z.enum(setTypes),
  seconds: z.number().int().min(0).max(36000).nullable().optional(), distanceM: z.number().min(0).max(200000).nullable().optional(),
  completedAt: z.string().datetime({ offset: true }), suggestedKg: z.number().min(0).max(1000).nullable(), suggestedReps: z.number().int().min(0).max(500).nullable(),
  feedback: z.enum(['too_heavy', 'too_light', 'no_equipment']).nullable(),
})
const WorkoutIn = z.object({
  clientId: z.string().min(8).max(64), programDayId: Uuid.nullable(), name: z.string().trim().min(1).max(80),
  startedAt: z.string().datetime({ offset: true }), endedAt: z.string().datetime({ offset: true }), notes: z.string().max(500).nullable(), pain: z.boolean(),
  exercises: z.array(z.object({ exerciseId: z.number().int(), sets: z.array(SetIn).max(30) })).max(40),
})
export async function saveWorkoutAction(input: z.input<typeof WorkoutIn>): Promise<R<{ id: string; prs: { exerciseId: number; type: string; value: number; previous: number }[]; duplicate: boolean }>> {
  const userId = await uid()
  const p = WorkoutIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Antrenman verisi geçersiz' }
  const start = Date.parse(p.data.startedAt), end = Date.parse(p.data.endedAt)
  if (!(end >= start) || start < Date.now() - 14 * 86400000 || end > Date.now() + 10 * 60000) return { ok: false, error: 'Antrenman zamanı geçersiz' }
  if (!p.data.exercises.some((e) => e.sets.length)) return { ok: false, error: 'En az bir set tamamla' }
  return run(async () => {
    const r = await saveWorkout(userId, { ...p.data, exercises: p.data.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, type: s.type as never, seconds: s.seconds ?? null })) })) })
    return { id: r.id, prs: r.prs, duplicate: r.duplicate }
  })
}
export async function deleteWorkoutAction(id: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { if (!(await deleteWorkout(userId, id))) throw new Error('Antrenman bulunamadı'); return {} })
}

const cardioTypes = Object.keys(CARDIO) as [string, ...string[]]
const CardioIn = z.object({
  type: z.enum(cardioTypes), minutes: z.number().min(1).max(600), distanceKm: z.number().min(0.05).max(300).nullable(), avgHr: z.number().int().min(40).max(230).nullable(),
  intensity: z.enum(['hafif', 'orta', 'yoğun']), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().trim().max(120).nullable(),
})
export async function logCardioAction(input: z.input<typeof CardioIn>): Promise<R<{ gross: number; net: number; method: string }>> {
  const userId = await uid()
  const p = CardioIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Süre 1–600 dk; mesafe ve nabız isteğe bağlı' }
  const today = dayString(), day = p.data.day ?? today
  if (day > today || day < addDays(today, -14)) return { ok: false, error: 'Yalnızca son 14 gün için kayıt eklenebilir' }
  const maxKmh = CARDIO_MAX_KMH[p.data.type]
  if (p.data.distanceKm && maxKmh && p.data.distanceKm / (p.data.minutes / 60) > maxKmh) return { ok: false, error: `Bu mesafe bu sürede olmaz (en fazla ${maxKmh} km/sa). Süreyi ya da mesafeyi kontrol et.` }
  return run(async () => {
    const r = await logCardio(userId, { ...p.data, type: p.data.type as never, day, note: p.data.note || null })
    return { gross: r.gross, net: r.net, method: r.method }
  })
}
export async function deleteCardioAction(id: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await deleteCardio(userId, id); return {} })
}

const CustomIn = z.object({
  name: z.string().trim().min(2).max(60), primary: z.string().min(2).max(30), equipment: z.enum(ALL_EQUIPMENT),
  kind: z.enum(['weight_reps', 'bodyweight', 'assisted', 'time', 'distance_time']), pattern: z.enum(['push', 'pull', 'legs', 'core', 'cardio', 'other']),
})
export async function createCustomExerciseAction(input: z.input<typeof CustomIn>): Promise<R<{ id: number }>> {
  const userId = await uid()
  const p = CustomIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Ad 2–60 karakter; kas, ekipman ve tür seç' }
  return run(async () => ({ id: await createCustomExercise(userId, p.data) }))
}

const GymIn = z.object({
  barKg: z.number().min(0).max(40), increment: z.number().min(0.5).max(10), plates: z.array(z.number().min(0.25).max(50)).min(1).max(12),
  equipment: z.array(z.enum(ALL_EQUIPMENT)).min(1), sessionMinutes: z.number().int().min(20).max(150),
})
export async function updateGymAction(input: z.input<typeof GymIn>): Promise<R> {
  const userId = await uid()
  const p = GymIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz salon ayarı' }
  return run(async () => {
    await ensureGym(userId)
    await db.update(schema.gymSettings).set({ ...p.data, plates: [...new Set(p.data.plates)].sort((a, b) => b - a), updatedAt: new Date() }).where(eq(schema.gymSettings.userId, userId))
    return {}
  })
}

/** Canlı moda sonradan eklenen hareketin hedefi + geçmişi (öneri istemcide hesaplanır). */
export async function liveExerciseAction(exerciseId: number): Promise<R<{ exercise: LiveExercise }>> {
  const userId = await uid()
  if (!Number.isInteger(exerciseId)) return { ok: false, error: 'Geçersiz' }
  const s = await liveSession(userId, null, [exerciseId])
  const exercise = s.exercises[0]
  return exercise ? { ok: true, exercise } : { ok: false, error: 'Hareket bulunamadı' }
}

// ───────── Faz 3b ─────────
const SettingsIn = z.object({ periodization: z.enum(['linear', 'dup', 'block']), deloadEvery: z.number().int().min(0).max(12) })
export async function updateProgramSettingsAction(id: string, input: z.input<typeof SettingsIn>): Promise<R> {
  const userId = await uid()
  const p = SettingsIn.safeParse(input)
  if (!Uuid.safeParse(id).success || !p.success) return { ok: false, error: 'Geçersiz ayar' }
  return run(async () => { await updateProgramSettings(userId, id, p.data); return {} })
}
export async function setSchemeKgAction(peId: string, kg: number): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(peId).success || !(kg >= 0 && kg <= 500)) return { ok: false, error: 'Ağırlık 0–500 kg' }
  return run(async () => { await setSchemeKg(userId, peId, Math.round(kg * 100) / 100); return {} })
}
export async function alternativesAction(exerciseId: number): Promise<R<{ list: { id: number; nameTr: string; equipment: string }[] }>> {
  const userId = await uid()
  if (!Number.isInteger(exerciseId)) return { ok: false, error: 'Geçersiz' }
  return { ok: true, list: await alternativesFor(userId, exerciseId) }
}
const cm = z.number().min(10).max(250).nullable()
const MeasureIn = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), waistCm: cm, chestCm: cm, hipsCm: cm, armCm: cm, thighCm: cm, calfCm: cm, neckCm: cm,
  bodyFatPct: z.number().min(2).max(70).nullable(), note: z.string().trim().max(120).nullable(),
})
export async function addMeasurementAction(input: z.input<typeof MeasureIn>): Promise<R> {
  const userId = await uid()
  const p = MeasureIn.safeParse(input)
  if (!p.success) return { ok: false, error: 'Ölçüler 10–250 cm, yağ oranı %2–70 olmalı' }
  const today = dayString()
  if (p.data.day > today) return { ok: false, error: 'Gelecek tarih olamaz' }
  const vals = Object.fromEntries(MEASURES.map((k) => [k, p.data[k]]))
  if (!MEASURES.some((k) => p.data[k] !== null)) return { ok: false, error: 'En az bir ölçü gir' }
  return run(async () => { await addMeasurement(userId, p.data.day, vals, p.data.note || null); return {} })
}
export async function deleteMeasurementAction(id: number): Promise<R> {
  const userId = await uid()
  if (!Number.isInteger(id)) return { ok: false, error: 'Geçersiz' }
  return run(async () => { await deleteMeasurement(userId, id); return {} })
}
export async function deleteMediaAction(id: string): Promise<R> {
  const userId = await uid()
  if (!Uuid.safeParse(id).success) return { ok: false, error: 'Geçersiz' }
  return run(async () => { if (!(await deleteMedia(userId, id))) throw new Error('Fotoğraf bulunamadı'); return {} })
}
