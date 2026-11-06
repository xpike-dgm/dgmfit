// Senaryo üretici: kişi × hedef × süre × davranış kombinasyonları (tohumlu, tekrarlanabilir).
import { ACTIVITY, bmi, computePlan, type Activity, type GoalType, type Sex } from '../calc.ts'
import type { Training } from './body.ts'
import { rng, seedOf } from './rng.ts'

export type Adherence = 'perfect' | 'good' | 'loose' | 'under'
export type Weighing = 'daily' | 'thrice' | 'weekly' | 'irregular'

export interface Scenario {
  id: string
  /** Kullanıcının uygulamaya girdiği bilgiler */
  sex: Sex; age: number; heightCm: number; weightKg: number; activity: Activity; goal: GoalType; targetWeightKg: number; planDays: number
  /** Gerçekte olan (uygulama bilmez) */
  bodyFatPct: number; activityTrue: number; metabolicBias: number; training: Training; trainDays: number
  adherence: Adherence; underreport: number; skipLogP: number; weighing: Weighing; appliesCheckin: boolean
  vacation: boolean; illness: boolean; typoWeight: boolean
  /** Hedefe ulaşınca Bugün kartındaki seçim: koruyup kas kazan | sonra (mevcut planla devam) */
  afterReach: 'recomp' | 'later'
  /** Hedef tarih geldi, hedefe ulaşılmadı: süreyi uzat | sonra */
  afterEnd: 'extend' | 'later'
  /** Planın bitiminden sonra da izlenen gün sayısı */
  tailDays: number
  tags: string[]
}

const ACTS: Activity[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']
const DURATIONS = [30, 90, 180, 365]

/** Deurenberg: VKİ + yaş + cinsiyetten yağ oranı tahmini (gerçek değer için başlangıç, üstüne kişisel sapma). */
export function deurenberg(bmiV: number, age: number, sex: Sex): number {
  return 1.2 * bmiV + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4
}

function make(id: string, over: Partial<Scenario> = {}): Scenario | null {
  const r = rng(seedOf(id))
  const sex: Sex = over.sex ?? (r.chance(0.5) ? 'male' : 'female')
  const age = over.age ?? r.int(16, 70)
  const heightCm = over.heightCm ?? Math.round(sex === 'male' ? r.normal(177, 7) : r.normal(163, 6.5))
  const bmiStart = r.pick([18.8, 20.5, 22.5, 24.5, 27, 30, 34, 40])
  const weightKg = over.weightKg ?? Math.round(bmiStart * (heightCm / 100) ** 2 * 10) / 10
  const bmiV = bmi(weightKg, heightCm)
  const goal: GoalType = over.goal ?? (bmiV < 20 ? r.pick(['gain', 'gain', 'recomp'] as const) : bmiV > 27 ? r.pick(['lose', 'lose', 'lose', 'recomp'] as const) : r.pick(['lose', 'gain', 'recomp'] as const))
  const minHealthy = 18.5 * (heightCm / 100) ** 2
  let target = over.targetWeightKg ?? weightKg
  if (over.targetWeightKg === undefined) {
    if (goal === 'lose') target = Math.max(Math.ceil(minHealthy + 0.5), Math.round((weightKg - r.pick([0.5, 2, 5, 10, 20, 40])) * 2) / 2)
    if (goal === 'gain') target = Math.round((weightKg + r.pick([0.5, 2, 4, 8, 15])) * 2) / 2
  }
  if (goal === 'lose' && target >= weightKg) return null
  const activity = over.activity ?? r.pick(ACTS)
  let planDays = over.planDays ?? r.pick(DURATIONS)
  if (goal !== 'recomp') {
    const p = computePlan({ sex, age, heightCm, weightKg, activity, goal, targetWeightKg: target, days: planDays })
    if (!p.allowed) planDays = Math.max(planDays, p.minDays) // kurulum izin vermez; kullanıcı en kısa süreyi seçer
  }
  const training: Training = over.training ?? r.pick(['none', 'novice', 'novice', 'intermediate', 'advanced'] as const)
  return {
    id, sex, age, heightCm, weightKg, activity, goal, targetWeightKg: target, planDays,
    bodyFatPct: over.bodyFatPct ?? Math.max(6, Math.min(55, deurenberg(bmiV, age, sex) + r.normal(0, 3))),
    activityTrue: over.activityTrue ?? ACTIVITY[activity].factor * (1 + r.normal(0, 0.06)),
    metabolicBias: over.metabolicBias ?? Math.max(0.85, Math.min(1.15, 1 + r.normal(0, 0.06))),
    training, trainDays: over.trainDays ?? (training === 'none' ? r.pick([0, 0, 2]) : r.pick([2, 3, 4, 5])),
    adherence: over.adherence ?? r.pick(['perfect', 'good', 'good', 'loose', 'under'] as const),
    underreport: over.underreport ?? r.pick([0, 0, 0.05, 0.1, 0.2]),
    skipLogP: over.skipLogP ?? r.pick([0, 0, 0.05, 0.15, 0.3]),
    weighing: over.weighing ?? r.pick(['daily', 'daily', 'thrice', 'weekly', 'irregular'] as const),
    appliesCheckin: over.appliesCheckin ?? r.chance(0.85),
    vacation: over.vacation ?? r.chance(0.2), illness: over.illness ?? r.chance(0.1), typoWeight: over.typoWeight ?? r.chance(0.1),
    afterReach: over.afterReach ?? (r.chance(0.6) ? 'recomp' : 'later'),
    afterEnd: over.afterEnd ?? (r.chance(0.75) ? 'extend' : 'later'),
    tailDays: over.tailDays ?? 30,
    tags: over.tags ?? [],
  }
}

/** Kullanıcının verdiği ve uç durumları kapsayan adlandırılmış senaryolar (her sette bulunur). */
export function namedScenarios(): Scenario[] {
  const ideal = { adherence: 'perfect' as const, underreport: 0, skipLogP: 0, weighing: 'daily' as const, appliesCheckin: true, vacation: false, illness: false, typoWeight: false, metabolicBias: 1 }
  const list: [string, Partial<Scenario>][] = [
    ['ornek-78-80-kas-200g', { sex: 'male', age: 27, heightCm: 178, weightKg: 78, activity: 'moderate', goal: 'gain', targetWeightKg: 80, planDays: 200, bodyFatPct: 17, training: 'novice', trainDays: 4, ...ideal, tags: ['kullanıcı örneği'] }],
    ['ornek-78-80-kas-hizli-yiyen', { sex: 'male', age: 27, heightCm: 178, weightKg: 78, activity: 'moderate', goal: 'gain', targetWeightKg: 80, planDays: 200, bodyFatPct: 17, training: 'novice', trainDays: 4, ...ideal, adherence: 'loose', tags: ['kullanıcı örneği', 'hedefe erken ulaşma'] }],
    ['recomp-80-ortaseviye', { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'recomp', planDays: 180, bodyFatPct: 18, training: 'intermediate', trainDays: 4, ...ideal, tags: ['koruyup kas'] }],
    ['kadin-65-58-90g', { sex: 'female', age: 34, heightCm: 165, weightKg: 65, activity: 'light', goal: 'lose', targetWeightKg: 58, planDays: 90, bodyFatPct: 31, training: 'novice', trainDays: 3, ...ideal }],
    ['obez-130-95-365g', { sex: 'male', age: 45, heightCm: 182, weightKg: 130, activity: 'sedentary', goal: 'lose', targetWeightKg: 95, planDays: 365, bodyFatPct: 38, training: 'none', trainDays: 0, ...ideal }],
    ['genc-17-kilo-alma', { sex: 'male', age: 17, heightCm: 175, weightKg: 58, activity: 'active', goal: 'gain', targetWeightKg: 64, planDays: 180, bodyFatPct: 11, training: 'novice', trainDays: 3, ...ideal, tags: ['18 yaş altı'] }],
    ['yasli-68-kilo-verme', { sex: 'female', age: 68, heightCm: 158, weightKg: 74, activity: 'sedentary', goal: 'lose', targetWeightKg: 66, planDays: 180, bodyFatPct: 40, training: 'none', trainDays: 0, ...ideal }],
    ['zayif-ince-ileri-kas', { sex: 'male', age: 29, heightCm: 183, weightKg: 70, activity: 'moderate', goal: 'gain', targetWeightKg: 76, planDays: 365, bodyFatPct: 10, training: 'advanced', trainDays: 5, ...ideal }],
    ['dusuk-metabolizma-plato', { sex: 'female', age: 40, heightCm: 162, weightKg: 82, activity: 'light', goal: 'lose', targetWeightKg: 68, planDays: 180, bodyFatPct: 39, training: 'none', trainDays: 0, ...ideal, metabolicBias: 0.88, tags: ['plato'] }],
    ['eksik-kayit-yanlis-veri', { sex: 'male', age: 35, heightCm: 176, weightKg: 92, activity: 'light', goal: 'lose', targetWeightKg: 82, planDays: 120, bodyFatPct: 28, training: 'novice', trainDays: 2, adherence: 'good', underreport: 0.2, skipLogP: 0.3, weighing: 'irregular', appliesCheckin: true, vacation: true, illness: true, typoWeight: true, metabolicBias: 1, tags: ['kötü veri'] }],
    ['az-yiyen-kilo-alamayan', { sex: 'male', age: 22, heightCm: 180, weightKg: 62, activity: 'active', goal: 'gain', targetWeightKg: 70, planDays: 180, bodyFatPct: 12, training: 'novice', trainDays: 4, ...ideal, adherence: 'under', tags: ['ters yön'] }],
    ['kisa-30g-hedef', { sex: 'female', age: 26, heightCm: 168, weightKg: 62, activity: 'moderate', goal: 'lose', targetWeightKg: 60, planDays: 30, bodyFatPct: 27, training: 'novice', trainDays: 3, ...ideal }],
  ]
  return list.map(([id, o]) => make(id, o)!).filter(Boolean)
}

/** Rastgele + adlandırılmış senaryo seti. `n` rastgele senaryo sayısı. */
export function scenarioSet(n: number, prefix = 's'): Scenario[] {
  const out = namedScenarios()
  for (let i = 0; out.length < n + namedScenarios().length && i < n * 3; i++) {
    const s = make(`${prefix}${i}`)
    if (s) out.push(s)
  }
  return out
}
