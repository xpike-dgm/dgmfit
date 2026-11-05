/**
 * Faz 5h-4: Ağırsağlam ücretsiz programlarını DgFit program gününe çevirir (saf; test edilir).
 * Paket depoda değil; bu dosya yalnızca biçim dönüşümü ve kendi kısa Türkçe etiketlerimizi içerir.
 */
import type { ProgramDay, ProgramExercise } from './programs.ts'

export interface AgSub { name: string; note?: string; reps?: number; repsRange?: [number, number]; timeInSeconds?: number; timeInMinutes?: number }
export interface AgEntry extends AgSub { sets: number; rir?: number; restTimeInMinutes?: number; restTimeInSeconds?: number; subExercises?: AgSub[] }
export interface AgWorkout { name: string; weekday: string | null; exerciseEntries: AgEntry[] }
export interface AgProgram {
  id: string; index: number; name: string; type: string; level: string; numberOfWorkouts: number
  trainingEnvironments: string[]; equipment: string[]; targetMuscles: string[]; goals: string[]
  descriptions: { tr?: string; en?: string }; workouts: AgWorkout[]
}

export const AG_PROGRAM_PREFIX = 'ag-'

const DAY_TR: Record<string, string> = {
  'Workout A': 'Antrenman A', 'Workout B': 'Antrenman B', 'Workout C': 'Antrenman C',
  'Upper A': 'Üst vücut A', 'Upper B': 'Üst vücut B', 'Lower A': 'Alt vücut A', 'Lower B': 'Alt vücut B',
  Push: 'İtiş', Pull: 'Çekiş', Legs: 'Bacak', 'Leg Day': 'Bacak günü', Arms: 'Kol', 'Arm Day': 'Kol günü',
  Back: 'Sırt', 'Back Day': 'Sırt günü', Chest: 'Göğüs', 'Chest Day': 'Göğüs günü', Shoulders: 'Omuz', 'Shoulder Day': 'Omuz günü',
  'Anterior Focused': 'Ön zincir odaklı', 'Posterior Focused': 'Arka zincir odaklı', Control: 'Kontrol', Intensity: 'Yoğunluk', Volume: 'Hacim',
}
const WEEKDAY_TR: Record<string, string> = { Monday: 'Pazartesi', Tuesday: 'Salı', Wednesday: 'Çarşamba', Thursday: 'Perşembe', Friday: 'Cuma', Saturday: 'Cumartesi', Sunday: 'Pazar' }
const NOTE_TR: Record<string, string> = {
  'both sides': 'iki taraf', 'max reps': 'maksimum tekrar', amrap: 'AMRAP: yapabildiğin kadar', 'amrap finisher': 'bitiriş: yapabildiğin kadar',
  'max time': 'maksimum süre', 'max reps (alternatively band assisted chin up)': 'maksimum tekrar (alternatif: lastik destekli chin up)',
}
export const AG_LEVEL_TR: Record<string, string> = { Beginner: 'Başlangıç', Intermediate: 'Orta', Advanced: 'İleri' }
export const AG_ENV_TR: Record<string, string> = { 'Home Gym': 'Ev', 'Fully Equipped Gym': 'Salon', 'Garage Gym': 'Garaj' }
export const AG_TARGET_TR: Record<string, string> = { 'Total Body': 'Tüm vücut', Shoulders: 'Omuz', Chest: 'Göğüs', Back: 'Sırt', Arms: 'Kol', Abs: 'Karın', Legs: 'Bacak', Glutes: 'Kalça' }
export const AG_GOAL_TR: Record<string, string> = { Bodybuilding: 'Vücut geliştirme', 'Fat Loss': 'Yağ yakımı', Strength: 'Kuvvet', Powerlifting: 'Powerlifting', Athleticism: 'Atletizm' }
export const AG_EQUIP_TR: Record<string, string> = { Dumbbell: 'Dambıl', Band: 'Lastik', 'Pull Up Bar': 'Barfiks barı', Barbell: 'Barbell', Cable: 'Kablo', Machines: 'Makine', 'Smith Machine': 'Smith', 'Body Weight': 'Vücut ağırlığı', 'EZ Bar': 'EZ bar' }

/** Pakette karşılığı olmayan iki alt hareket → en yakın hareket (DECISIONS 2026-11-06). Değer: paket adı ya da kütüphane anahtarı. */
export const AG_NAME_ALIAS: Record<string, { name?: string; key?: string }> = {
  'Biceps Curl Banded': { name: 'Inverted Biceps Curl' },
  'Triceps Overhead Extension Banded': { key: 'Speed_Band_Overhead_Triceps' },
}

export const noteTr = (n?: string) => { const t = (n ?? '').trim(); return t ? NOTE_TR[t.toLowerCase()] ?? t : '' }
const isMax = (n?: string) => /max|amrap/i.test(n ?? '')

export function dayNameTr(name: string, i: number) { const n = name.trim(); return n ? DAY_TR[n] ?? n : `Gün ${i + 1}` }

export function agSummary(p: AgProgram) {
  return {
    id: AG_PROGRAM_PREFIX + p.id, name: p.name, level: AG_LEVEL_TR[p.level] ?? p.level, levelKey: p.level === 'Beginner' ? 'new' : p.level === 'Advanced' ? 'adv' : 'mid',
    days: p.workouts.length, env: p.trainingEnvironments.map((e) => AG_ENV_TR[e] ?? e), home: p.trainingEnvironments.some((e) => e !== 'Fully Equipped Gym'),
    targets: p.targetMuscles.map((m) => AG_TARGET_TR[m] ?? m), goals: p.goals.map((g) => AG_GOAL_TR[g] ?? g), equipment: p.equipment.map((e) => AG_EQUIP_TR[e] ?? e),
    description: (p.descriptions.tr || p.descriptions.en || '').trim(), dayNames: p.workouts.map((w, i) => dayNameTr(w.name, i)),
    supersets: p.workouts.reduce((n, w) => n + w.exerciseEntries.filter((e) => e.subExercises?.length).length, 0),
  }
}

/** Bir girdinin (ya da süperset alt hareketinin) hedefi. Tekrar yoksa ve not "max/AMRAP" diyorsa AMRAP seti. */
function target(s: AgSub, e: AgEntry, inSuperset: boolean) {
  const seconds = s.timeInSeconds ? Math.round(s.timeInSeconds) : s.timeInMinutes ? Math.round(s.timeInMinutes * 60) : null
  let repMin = 8, repMax = 12, type: ProgramExercise['type'] = 'normal' // süperset grubu `superset` alanıyla; set tipi normal kalır (set numaraları görünsün)
  if (seconds) { repMin = repMax = 1 }
  else if (s.repsRange) { repMin = Math.min(...s.repsRange); repMax = Math.max(...s.repsRange) }
  else if (s.reps) { repMin = repMax = Math.round(s.reps) }
  else if (isMax(s.note ?? e.note)) { repMin = 5; repMax = 30; type = 'amrap' }
  const restRaw = (e.restTimeInMinutes ?? 0) * 60 + (e.restTimeInSeconds ?? 0)
  const rest = restRaw > 0 ? Math.round(restRaw) : inSuperset ? 60 : repMax <= 6 ? 180 : 90
  // program_exercises.rir tam sayı: yarım değerler aşağı yuvarlanır (0,5 → 0)
  const rir = e.rir != null ? Math.max(0, Math.floor(e.rir)) : type === 'amrap' ? 0 : 2
  return { sets: Math.max(1, Math.min(10, Math.round(e.sets))), repMin, repMax, rir, rest, seconds: seconds ?? undefined, type }
}

/**
 * Programın günleri. `keyOf(ad)` → hareket anahtarı (yoksa null → hareket atlanır, `missing`e yazılır).
 * Süperset alt hareketleri aynı `superset` numarasını taşır (gün içinde 1, 2, …).
 */
export function agProgramDays(p: AgProgram, keyOf: (name: string) => string | null): { days: ProgramDay[]; missing: string[] } {
  const missing: string[] = []
  const days = p.workouts.map((w, i) => {
    const exercises: ProgramExercise[] = []
    let group = 0
    for (const e of w.exerciseEntries) {
      const subs = e.subExercises?.length ? e.subExercises : null
      const g = subs ? ++group : null
      for (const s of subs ?? [e]) {
        const key = keyOf(s.name)
        if (!key) { missing.push(s.name); continue }
        exercises.push({ key, role: exercises.length === 0 ? 'ana' : 'yardımcı', ...target(s, e, !!subs), superset: g, note: noteTr(s.note) || (subs ? '' : noteTr(e.note)) || null })
      }
    }
    // tek üyesi kalan süperset normal harekete döner
    for (const g of new Set(exercises.map((x) => x.superset).filter(Boolean))) {
      const m = exercises.filter((x) => x.superset === g)
      if (m.length < 2) for (const x of m) x.superset = null
    }
    return { name: dayNameTr(w.name, i), focus: w.weekday ? WEEKDAY_TR[w.weekday] ?? '' : '', exercises }
  })
  return { days, missing }
}

/** Ad → anahtar çözücü: paket adı (ag kimliği üzerinden) + takma adlar. */
export function agKeyResolver(agNameToId: Map<string, number>, agIdToKey: Map<number, string>, libraryKeys: Set<string>) {
  return (name: string): string | null => {
    const alias = AG_NAME_ALIAS[name]
    if (alias?.key) return libraryKeys.has(alias.key) ? alias.key : null
    const id = agNameToId.get(alias?.name ?? name)
    return id != null ? agIdToKey.get(id) ?? null : null
  }
}
