// AI program oluşturucunun kural denetimi — saf, testli (tests/planner.test.ts). Spesifikasyon 4.2 ve 10 ("dil modeli + kurallar").
// Dil modeli hareket adlarını ve hedefleri önerir; burada kütüphane eşleşmesi sonrası sınırlar uygulanır ve hacim denetlenir.
import { setsByMuscle, SET_BAND } from './progress.ts'
import { MUSCLES } from './exercise-labels.ts'

export type Experience = 'new' | 'mid' | 'adv'
export interface RawExercise { name: string; sets: number; repMin: number; repMax: number; rir: number; rest: number }
export interface ResolvedEx extends RawExercise { exerciseId: number; key: string; nameTr: string; kind: string; equipment: string; primary: string[]; secondary: string[] }
export interface CheckedDay { name: string; focus: string; exercises: ResolvedEx[] }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))
/** Seans süresine göre en fazla hareket: yaklaşık 9 dk/hareket (ısınma + setler + dinlenme), 3–9 arası. */
export const maxExercises = (minutes: number) => clamp(minutes / 9, 3, 9)
export const MAJOR = ['chest', 'lats', 'middle back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes']

/** Bir hareketin hedeflerini güvenli sınırlara çeker: yeni başlayan en fazla 4 set ve RIR ≥ 1; süreli harekette tekrar 1. */
export function clampTargets(e: RawExercise, kind: string, exp: Experience): RawExercise {
  const time = kind === 'time'
  const repMin = time ? 1 : clamp(e.repMin, 3, 30)
  return {
    name: e.name,
    sets: clamp(e.sets, 1, exp === 'new' ? 4 : 6),
    repMin,
    repMax: time ? 1 : clamp(Math.max(e.repMax, repMin), repMin, 30),
    rir: clamp(e.rir, exp === 'new' ? 1 : 0, 4),
    rest: clamp(e.rest, 30, 300),
  }
}

export interface ProgramCheck { days: CheckedDay[]; weekly: Record<string, number>; warnings: string[]; dropped: string[] }

/**
 * Eşleşmiş günleri denetler: gün sayısı istenene eşitlenir (fazlası atılır), aynı günde tekrar eden hareket atılır,
 * seans başına hareket sınırı, ekipman uygunluğu; haftalık kas başına set (birincil 1, ikincil 0,5) 10–20 bandına göre uyarı.
 */
export function checkProgram(i: { days: { name: string; focus: string; exercises: (ResolvedEx | { unresolved: string })[] }[]; wantDays: number; minutes: number; exp: Experience; equipment: Set<string>; weak: string[] }): ProgramCheck {
  const dropped: string[] = []
  const warnings: string[] = []
  const max = maxExercises(i.minutes)
  const days: CheckedDay[] = i.days.slice(0, i.wantDays).map((d, di) => {
    const seen = new Set<number>()
    const out: ResolvedEx[] = []
    for (const e of d.exercises) {
      if ('unresolved' in e) { dropped.push(`${e.unresolved} (kütüphanede yok)`); continue }
      if (seen.has(e.exerciseId)) continue
      if (!i.equipment.has(e.equipment) && e.equipment !== 'body only') { dropped.push(`${e.nameTr} (ekipman yok)`); continue }
      if (out.length >= max) { dropped.push(`${e.nameTr} (seans süresine sığmıyor)`); continue }
      seen.add(e.exerciseId)
      out.push({ ...e, ...clampTargets(e, e.kind, i.exp) })
    }
    return { name: (d.name || `Gün ${di + 1}`).slice(0, 60), focus: (d.focus || '').slice(0, 80), exercises: out }
  })
  if (days.length < i.wantDays) warnings.push(`${i.wantDays} gün istendi, ${days.length} gün oluşturuldu.`)
  const weekly = setsByMuscle(days.flatMap((d) => d.exercises.flatMap((e) => Array.from({ length: e.sets }, () => ({ primary: e.primary, secondary: e.secondary })))))
  for (const m of MAJOR) {
    const n = weekly[m] ?? 0
    if (n < SET_BAND.min / 2) warnings.push(`${MUSCLES[m]}: haftada ${n} set, düşük (öneri ${SET_BAND.min}–${SET_BAND.max}).`)
    else if (n > SET_BAND.max) warnings.push(`${MUSCLES[m]}: haftada ${n} set, yüksek (öneri en fazla ${SET_BAND.max}).`)
  }
  for (const w of i.weak) {
    const n = weekly[w] ?? 0
    if (n < SET_BAND.min) warnings.push(`Zayıf bölge ${MUSCLES[w] ?? w}: haftada ${n} set; en az ${SET_BAND.min} set önerilir.`)
  }
  if (days.some((d) => d.exercises.length === 0)) warnings.push('Boş gün var; programı düzenleyerek hareket ekleyebilirsin.')
  return { days, weekly, warnings, dropped }
}
