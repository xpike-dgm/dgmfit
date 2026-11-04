// Program şablonları ve kural tabanlı program üretici (saf). Testler: tests/programs.test.ts
// Her yuva (slot) ekipmana göre sıralı alternatifler taşır; hareket anahtarları data/exercises-src.json'daki id'lerdir (test doğrular).
import type { SetType } from './training.ts'

export interface SlotTarget { sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds?: number; type?: SetType }
export interface Slot extends SlotTarget { alts: string[]; role: 'ana' | 'yardımcı' | 'izolasyon' | 'core' }
export interface TemplateDay { name: string; focus: string; slots: Slot[] }
export interface Template { id: string; name: string; daysPerWeek: number; level: 'new' | 'mid' | 'adv'; description: string; days: TemplateDay[] }

const A = (role: Slot['role'], alts: string[], sets: number, repMin: number, repMax: number, rir = 2, rest = 120, extra: Partial<SlotTarget> = {}): Slot => ({ role, alts, sets, repMin, repMax, rir, rest, ...extra })

// Hareket grupları (ekipman sırasıyla: barbell → dumbbell → makine/kablo → vücut ağırlığı)
const SQUAT = ['Barbell_Squat', 'Smith_Machine_Squat', 'Goblet_Squat', 'Leg_Press', 'Bodyweight_Squat']
const LEGPRESS = ['Leg_Press', 'Hack_Squat', 'Goblet_Squat', 'Bodyweight_Squat']
const HINGE = ['Romanian_Deadlift', 'Stiff-Legged_Barbell_Deadlift', 'Kettlebell_One-Legged_Deadlift', 'Hyperextensions_Back_Extensions', 'Barbell_Glute_Bridge', 'Glute_Kickback']
const DEADLIFT = ['Barbell_Deadlift', 'Sumo_Deadlift', 'Romanian_Deadlift', 'Kettlebell_One-Legged_Deadlift']
const LUNGE = ['Split_Squat_with_Dumbbells', 'Dumbbell_Lunges', 'Barbell_Lunge', 'Dumbbell_Step_Ups', 'Bodyweight_Squat']
const LEGCURL = ['Lying_Leg_Curls', 'Seated_Leg_Curl', 'Romanian_Deadlift', 'Glute_Kickback']
const LEGEXT = ['Leg_Extensions', 'Goblet_Squat', 'Bodyweight_Squat']
const CALF = ['Standing_Calf_Raises', 'Seated_Calf_Raise', 'Standing_Calf_Raises']
const HIP = ['Barbell_Hip_Thrust', 'Barbell_Glute_Bridge', 'Glute_Kickback']
const BENCH = ['Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bench_Press', 'Machine_Bench_Press', 'Leverage_Chest_Press', 'Pushups']
const INCLINE = ['Incline_Dumbbell_Press', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Leverage_Chest_Press', 'Pushups']
const FLY = ['Cable_Crossover', 'Butterfly', 'Dumbbell_Flyes', 'Pushups']
const OHP = ['Standing_Military_Press', 'Seated_Dumbbell_Press', 'Machine_Shoulder_Military_Press', 'Leverage_Shoulder_Press', 'Pushups']
const LATERAL = ['Side_Lateral_Raise', 'Upright_Barbell_Row']
const REAR = ['Face_Pull', 'Reverse_Flyes']
const ROW = ['Bent_Over_Barbell_Row', 'One-Arm_Dumbbell_Row', 'Seated_Cable_Rows', 'T-Bar_Row_with_Handle', 'Inverted_Row']
const CABLEROW = ['Seated_Cable_Rows', 'One-Arm_Dumbbell_Row', 'Bent_Over_Barbell_Row', 'Inverted_Row']
const VPULL = ['Wide-Grip_Lat_Pulldown', 'Pullups', 'Close-Grip_Front_Lat_Pulldown', 'Chin-Up', 'Inverted_Row']
const CURL = ['Barbell_Curl', 'Dumbbell_Bicep_Curl', 'Preacher_Curl', 'Inverted_Row']
const CURL2 = ['Hammer_Curls', 'Incline_Dumbbell_Curl', 'Dumbbell_Bicep_Curl']
const TRI = ['Triceps_Pushdown', 'Triceps_Pushdown_-_Rope_Attachment', 'Standing_Dumbbell_Triceps_Extension', 'Dips_-_Triceps_Version']
const TRI2 = ['EZ-Bar_Skullcrusher', 'Lying_Triceps_Press', 'Standing_Dumbbell_Triceps_Extension', 'Close-Grip_Barbell_Bench_Press', 'Dips_-_Triceps_Version']
const ABS = ['Cable_Crunch', 'Hanging_Leg_Raise', 'Crunches']
const PLANK = ['Plank']
const SHRUG = ['Barbell_Shrug', 'Dumbbell_Shrug']

const plank = A('core', PLANK, 2, 1, 1, 2, 60, { seconds: 45 })

export const TEMPLATES: Template[] = [
  {
    id: 'fullbody', name: 'Full Body (A/B)', daysPerWeek: 3, level: 'new',
    description: 'Haftada 3 gün tüm vücut; A ve B günleri dönüşümlü. Yeni başlayanlar için en verimli başlangıç.',
    days: [
      { name: 'Tüm vücut A', focus: 'Squat · göğüs · sırt', slots: [A('ana', SQUAT, 3, 6, 10, 2, 150), A('ana', BENCH, 3, 6, 10, 2, 150), A('yardımcı', ROW, 3, 8, 12), A('izolasyon', LATERAL, 2, 12, 15, 1, 60), plank] },
      { name: 'Tüm vücut B', focus: 'Kalça · omuz · sırt', slots: [A('ana', HINGE, 3, 8, 10, 2, 150), A('ana', OHP, 3, 6, 10, 2, 150), A('yardımcı', VPULL, 3, 8, 12), A('yardımcı', LUNGE, 2, 8, 12), A('izolasyon', CURL, 2, 10, 15, 1, 60), A('izolasyon', TRI, 2, 10, 15, 1, 60)] },
    ],
  },
  {
    id: 'upperlower', name: 'Upper / Lower', daysPerWeek: 4, level: 'mid',
    description: 'Haftada 4 gün: iki üst vücut, iki alt vücut. Her kas haftada 2 kez çalışır.',
    days: [
      { name: 'Üst vücut A', focus: 'Kuvvet ağırlıklı', slots: [A('ana', BENCH, 4, 5, 8, 2, 180), A('ana', ROW, 4, 6, 10, 2, 150), A('yardımcı', OHP, 3, 8, 10), A('yardımcı', VPULL, 3, 8, 12), A('izolasyon', CURL, 2, 10, 12, 1, 60), A('izolasyon', TRI, 2, 10, 12, 1, 60)] },
      { name: 'Alt vücut A', focus: 'Squat ağırlıklı', slots: [A('ana', SQUAT, 4, 5, 8, 2, 180), A('yardımcı', HINGE, 3, 8, 10, 2, 150), A('yardımcı', LUNGE, 3, 8, 12), A('izolasyon', LEGCURL, 3, 10, 15, 1, 75), A('izolasyon', CALF, 3, 10, 15, 1, 60), A('core', ABS, 2, 10, 15, 1, 60)] },
      { name: 'Üst vücut B', focus: 'Hacim ağırlıklı', slots: [A('ana', INCLINE, 3, 8, 12), A('ana', CABLEROW, 3, 10, 12), A('yardımcı', VPULL, 3, 10, 12), A('izolasyon', FLY, 2, 12, 15, 1, 60), A('izolasyon', LATERAL, 3, 12, 15, 1, 60), A('izolasyon', REAR, 2, 12, 15, 1, 60), A('izolasyon', CURL2, 2, 10, 15, 1, 60), A('izolasyon', TRI2, 2, 10, 15, 1, 60)] },
      { name: 'Alt vücut B', focus: 'Kalça ağırlıklı', slots: [A('ana', DEADLIFT, 3, 4, 6, 2, 180), A('yardımcı', LEGPRESS, 3, 10, 12), A('yardımcı', HIP, 3, 8, 12), A('izolasyon', LEGEXT, 3, 12, 15, 1, 60), A('izolasyon', CALF, 3, 10, 15, 1, 60), plank] },
    ],
  },
  {
    id: 'ppl', name: 'Push / Pull / Legs', daysPerWeek: 3, level: 'mid',
    description: 'İtme, çekme ve bacak günleri. Haftada 3 gün (her kas 1 kez) ya da 6 gün (2 kez) uygulanır.',
    days: [
      { name: 'Push', focus: 'Göğüs · omuz · triceps', slots: [A('ana', BENCH, 4, 6, 10, 2, 150), A('yardımcı', OHP, 3, 8, 10), A('yardımcı', INCLINE, 3, 8, 12), A('izolasyon', LATERAL, 3, 12, 15, 1, 60), A('izolasyon', TRI, 3, 10, 15, 1, 60)] },
      { name: 'Pull', focus: 'Sırt · arka omuz · biceps', slots: [A('ana', ROW, 4, 6, 10, 2, 150), A('yardımcı', VPULL, 3, 8, 12), A('yardımcı', CABLEROW, 3, 10, 12), A('izolasyon', REAR, 3, 12, 15, 1, 60), A('izolasyon', CURL, 3, 10, 12, 1, 60), A('izolasyon', SHRUG, 2, 10, 15, 1, 60)] },
      { name: 'Legs', focus: 'Ön bacak · arka bacak · kalça', slots: [A('ana', SQUAT, 4, 6, 10, 2, 180), A('yardımcı', HINGE, 3, 8, 10, 2, 150), A('yardımcı', LEGPRESS, 3, 10, 12), A('izolasyon', LEGCURL, 3, 10, 15, 1, 75), A('izolasyon', CALF, 3, 10, 15, 1, 60), A('core', ABS, 2, 10, 15, 1, 60)] },
    ],
  },
  {
    id: 'brosplit', name: 'Bro Split (5 gün)', daysPerWeek: 5, level: 'adv',
    description: 'Her gün bir kas grubu. Yüksek hacim; deneyimli sporcular için.',
    days: [
      { name: 'Göğüs', focus: 'Göğüs', slots: [A('ana', BENCH, 4, 6, 10, 2, 150), A('yardımcı', INCLINE, 4, 8, 12), A('izolasyon', FLY, 3, 12, 15, 1, 60), A('yardımcı', ['Dips_-_Chest_Version', 'Pushups'], 3, 8, 12)] },
      { name: 'Sırt', focus: 'Sırt', slots: [A('ana', DEADLIFT, 3, 4, 6, 2, 180), A('ana', VPULL, 4, 8, 12), A('yardımcı', ROW, 4, 8, 10), A('yardımcı', CABLEROW, 3, 10, 12), A('izolasyon', ['Straight-Arm_Dumbbell_Pullover'], 2, 12, 15, 1, 60)] },
      { name: 'Omuz', focus: 'Omuz · trapez', slots: [A('ana', OHP, 4, 6, 10, 2, 150), A('yardımcı', ['Arnold_Dumbbell_Press', 'Seated_Dumbbell_Press'], 3, 8, 12), A('izolasyon', LATERAL, 4, 12, 15, 1, 60), A('izolasyon', REAR, 3, 12, 15, 1, 60), A('izolasyon', SHRUG, 3, 10, 15, 1, 60)] },
      { name: 'Bacak', focus: 'Bacak', slots: [A('ana', SQUAT, 4, 6, 10, 2, 180), A('yardımcı', LEGPRESS, 3, 10, 12), A('yardımcı', HINGE, 3, 8, 10, 2, 150), A('izolasyon', LEGEXT, 3, 12, 15, 1, 60), A('izolasyon', LEGCURL, 3, 10, 15, 1, 60), A('izolasyon', CALF, 4, 10, 15, 1, 60)] },
      { name: 'Kol', focus: 'Biceps · triceps · karın', slots: [A('yardımcı', ['Close-Grip_Barbell_Bench_Press', 'Dips_-_Triceps_Version'], 3, 6, 10), A('yardımcı', CURL, 3, 8, 12), A('izolasyon', TRI2, 3, 10, 12, 1, 60), A('izolasyon', CURL2, 3, 10, 12, 1, 60), A('izolasyon', TRI, 3, 12, 15, 1, 60), A('core', ABS, 3, 10, 15, 1, 60)] },
    ],
  },
  {
    id: 'gzclp', name: 'GZCLP (basitleştirilmiş)', daysPerWeek: 4, level: 'mid',
    description: 'T1 ağır (5×3), T2 orta (3×10), T3 hafif (3×15+). İlerleme çift aşamalı kuralla; orijinal set düşürme şeması 3b\'de.',
    days: [
      { name: 'Gün 1', focus: 'T1 squat · T2 bench', slots: [A('ana', SQUAT, 5, 3, 3, 1, 180), A('yardımcı', BENCH, 3, 10, 10, 2, 120), A('izolasyon', VPULL, 3, 15, 20, 1, 75)] },
      { name: 'Gün 2', focus: 'T1 OHP · T2 deadlift', slots: [A('ana', OHP, 5, 3, 3, 1, 180), A('yardımcı', DEADLIFT, 3, 10, 10, 2, 150), A('izolasyon', ROW, 3, 15, 20, 1, 75)] },
      { name: 'Gün 3', focus: 'T1 bench · T2 squat', slots: [A('ana', BENCH, 5, 3, 3, 1, 180), A('yardımcı', SQUAT, 3, 10, 10, 2, 150), A('izolasyon', VPULL, 3, 15, 20, 1, 75)] },
      { name: 'Gün 4', focus: 'T1 deadlift · T2 OHP', slots: [A('ana', DEADLIFT, 5, 3, 3, 1, 180), A('yardımcı', OHP, 3, 10, 10, 2, 120), A('izolasyon', ROW, 3, 15, 20, 1, 75)] },
    ],
  },
]

export const ALL_EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'bands', 'e-z curl bar', 'body only', 'other'] as const
export const GYM = new Set<string>(ALL_EQUIPMENT)
export const HOME_DUMBBELL = new Set(['dumbbell', 'body only', 'bands'])
export const BODY_ONLY = new Set(['body only'])

/** Veri setinde kettlebell etiketli ama dumbbell ile aynı şekilde yapılan hareketler. */
const EQUIV: Record<string, string[]> = {
  Goblet_Squat: ['kettlebells', 'dumbbell'], 'Kettlebell_One-Legged_Deadlift': ['kettlebells', 'dumbbell'], 'One-Arm_Kettlebell_Swings': ['kettlebells', 'dumbbell'],
}
/** Vücut ağırlığıyla kolay kalan hareketlerde tekrar aralığı (ağırlık yuvasına düştüklerinde). */
const BW_REPS: Record<string, [number, number]> = { Bodyweight_Squat: [15, 25], Pushups: [8, 20], Inverted_Row: [8, 15], Glute_Kickback: [12, 20] }

export interface ProgramExercise extends SlotTarget { key: string; role: Slot['role'] }
export interface ProgramDay { name: string; focus: string; exercises: ProgramExercise[] }
export interface GeneratedProgram { templateId: string; name: string; days: ProgramDay[]; notes: string[] }

/** Şablonu ekipmana göre somutlaştırır: her yuva için ilk uygun alternatif. Uygun yoksa yuva düşer. */
export function instantiate(t: Template, equipmentOf: (key: string) => string, available: Set<string>, maxPerDay = 99): ProgramDay[] {
  const ok = (k: string) => { const e = equipmentOf(k); return e === 'body only' || available.has(e) || (EQUIV[k] ?? []).some((x) => available.has(x)) }
  return t.days.map((d) => {
    const used = new Set<string>()
    const exercises: ProgramExercise[] = []
    for (const s of d.slots) {
      if (exercises.length >= maxPerDay) break
      const key = s.alts.find((k) => ok(k) && !used.has(k))
      if (!key) continue
      used.add(key)
      const { alts: _a, ...target } = s
      const bw = BW_REPS[key]
      exercises.push({ key, ...target, ...(bw && target.repMax < bw[1] ? { repMin: Math.max(target.repMin, bw[0]), repMax: bw[1] } : {}) })
    }
    return { name: d.name, focus: d.focus, exercises }
  })
}

/**
 * Kural tabanlı program: gün sayısı + deneyim → şablon; ekipman → hareket seçimi; seans süresi → hareket sayısı (~9 dk/hareket);
 * yeni başlayanda ana hareketler en fazla 3 set; kilo verme hedefinde tekrar aralığı korunur (kuvveti korumak için ağırlık düşürülmez).
 */
export function generateProgram(i: { days: number; experience: 'new' | 'mid' | 'adv' | null; available: Set<string>; minutes: number; goal: 'lose' | 'gain' | 'recomp'; equipmentOf: (key: string) => string }): GeneratedProgram {
  const exp = i.experience ?? 'new'
  const d = Math.max(2, Math.min(6, Math.round(i.days)))
  const notes: string[] = []
  let t: Template, schedule: number[]
  const T = (id: string) => TEMPLATES.find((x) => x.id === id)!
  if (d <= 2) { t = T('fullbody'); schedule = [0, 1] }
  else if (d === 3) { t = exp === 'new' ? T('fullbody') : T('ppl'); schedule = exp === 'new' ? [0, 1, 0] : [0, 1, 2] }
  else if (d === 4) { t = T('upperlower'); schedule = [0, 1, 2, 3] }
  else if (d === 5) { t = exp === 'adv' ? T('brosplit') : T('upperlower'); schedule = exp === 'adv' ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 0] }
  else { t = T('ppl'); schedule = [0, 1, 2, 0, 1, 2] }
  if (d === 5 && exp !== 'adv') notes.push('5 gün: Upper/Lower + ek bir üst vücut günü.')
  const maxPerDay = Math.max(3, Math.floor(i.minutes / 9))
  const base = instantiate(t, i.equipmentOf, i.available, maxPerDay)
  const days = schedule.map((idx) => {
    const src = base[idx]
    return {
      name: src.name, focus: src.focus,
      exercises: src.exercises.map((e) => ({ ...e, sets: exp === 'new' && e.role === 'ana' ? Math.min(3, e.sets) : e.sets })),
    }
  })
  const dropped = t.days.reduce((a, td, k) => a + td.slots.length - base[k].exercises.length, 0)
  if (dropped) notes.push(`${dropped} hareket seans süresi ya da ekipman nedeniyle çıkarıldı.`)
  if (i.goal === 'lose') notes.push('Kalori açığında amaç kuvveti korumak: ağırlıkları düşürme, set sayısını gerekirse azalt.')
  return { templateId: t.id, name: `${t.name} · haftada ${d} gün`, days, notes }
}
