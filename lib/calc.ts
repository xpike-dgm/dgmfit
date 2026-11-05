// DgFit hesaplama motoru — saf fonksiyonlar (sunucu ve istemcide aynı sonuç).

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type GoalType = 'lose' | 'gain' | 'recomp'

export const KCAL_PER_KG = 7700

export const ACTIVITY: Record<Activity, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Hareketsiz', hint: 'Masa başı iş, spor yok' },
  light: { factor: 1.375, label: 'Az hareketli', hint: 'Haftada 1–3 gün hafif spor' },
  moderate: { factor: 1.55, label: 'Orta hareketli', hint: 'Haftada 3–5 gün spor' },
  active: { factor: 1.725, label: 'Çok hareketli', hint: 'Haftada 6–7 gün yoğun spor' },
  very_active: { factor: 1.9, label: 'Aşırı hareketli', hint: 'Ağır fiziksel iş + günlük antrenman' },
}

export const GOALS: Record<GoalType, { label: string; hint: string }> = {
  lose: { label: 'Kilo vermek', hint: 'Yağ kaybı, kontrollü kalori açığı' },
  gain: { label: 'Kilo almak', hint: 'Kas ağırlıklı, kontrollü kalori fazlası' },
  recomp: { label: 'Kilomu koruyup kas kazanmak', hint: 'Rekompozisyon: yüksek protein, bakım kalorisi' },
}

export const TEMPOS = [
  { id: 'easy', label: 'Rahat', kgPerWeek: 0.25 },
  { id: 'balanced', label: 'Dengeli', kgPerWeek: 0.5 },
  { id: 'fast', label: 'Hızlı', kgPerWeek: 0.75 },
] as const

export function ageFromBirthDate(birth: string, today: Date = new Date()): number {
  const b = new Date(birth + 'T00:00:00Z')
  let age = today.getUTCFullYear() - b.getUTCFullYear()
  const m = today.getUTCMonth() - b.getUTCMonth()
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--
  return age
}

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100
  return weightKg / (h * h)
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return 'zayıf'
  if (v < 25) return 'sağlıklı'
  if (v < 30) return 'fazla kilolu'
  return 'obez'
}

export function healthyWeightRange(heightCm: number): [number, number] {
  const h = heightCm / 100
  return [round1(18.5 * h * h), round1(24.9 * h * h)]
}

/** Mifflin-St Jeor */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function tdee(bmrValue: number, activity: Activity): number {
  return bmrValue * ACTIVITY[activity].factor
}

export function calorieFloor(sex: Sex): number {
  return sex === 'male' ? 1500 : 1200
}

export interface PlanInput {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: Activity
  goal: GoalType
  targetWeightKg: number
  days: number
}

export interface Plan {
  bmr: number
  tdee: number
  dailyKcal: number
  dailyDelta: number // negatif = açık, pozitif = fazla
  proteinG: number
  fatG: number
  carbG: number
  waterMl: number
  days: number
  weeklyKg: number
  safe: boolean
  /** Güvenli değilse önerilen en kısa süre (gün) */
  safeDays: number
  /** Kullanıcının seçtiği tempo kabul edilir mi (güvenli olmasa da). Yalnızca mutlak üst sınır aşılırsa false. */
  allowed: boolean
  /** Mutlak üst sınırla (haftada HARD_MAX_WEEKLY_KG) mümkün en kısa süre (gün) */
  minDays: number
  /** Kalori tabanı yüzünden gerçek tempo yavaşladıysa tahmini süre (gün), yoksa null */
  expectedDays: number | null
  warnings: string[]
}

/** Kullanıcı hedefine karışmayız; ancak haftada 1,5 kg'dan hızlı değişim hiçbir koşulda plan yapılmaz. */
export const HARD_MAX_WEEKLY_KG = 1.5

/** Haftalık en hızlı güvenli değişim (kg). */
export function maxWeeklyKg(goal: GoalType, weightKg: number): number {
  if (goal === 'lose') return weightKg * 0.01
  if (goal === 'gain') return weightKg * 0.005
  return 0
}

export function computePlan(p: PlanInput): Plan {
  const warnings: string[] = []
  const b = bmr(p.sex, p.weightKg, p.heightCm, p.age)
  const t = tdee(b, p.activity)
  const floor = calorieFloor(p.sex)
  const days = Math.max(1, Math.round(p.days))

  let delta = 0
  let safe = true
  let safeDays = days
  let allowed = true
  let minDays = 1
  let expectedDays: number | null = null

  if (p.goal === 'recomp') {
    delta = -Math.round(t * 0.05)
  } else {
    const diffKg = p.targetWeightKg - p.weightKg
    const totalKcal = Math.abs(diffKg) * KCAL_PER_KG
    const wanted = totalKcal / days
    let recommended = (maxWeeklyKg(p.goal, p.weightKg) * KCAL_PER_KG) / 7
    if (p.goal === 'lose') {
      recommended = Math.min(recommended, Math.max(0, t - floor))
      if (p.age < 18) recommended = Math.min(recommended, t * 0.2)
    }
    // 18 yaş altında önerilen sınır aynı zamanda mutlak sınırdır.
    const hardKg = p.age < 18 ? (recommended * 7) / KCAL_PER_KG : HARD_MAX_WEEKLY_KG
    const hard = (hardKg * KCAL_PER_KG) / 7
    minDays = hard > 0 ? Math.max(1, Math.ceil(totalKcal / hard)) : 0
    delta = (p.goal === 'lose' ? -1 : 1) * wanted
    if (hard <= 0 || wanted > hard + 0.5) {
      allowed = false
      safe = false
      safeDays = recommended > 0 ? Math.ceil(totalKcal / recommended) : 0
      warnings.push(p.age < 18
        ? `18 yaş altında haftada en fazla ${fmtNum(round2(hardKg), 2)} kg değişim planlanabilir. En az ${fmtNum(minDays)} gün seçmelisin.`
        : `Haftada ${fmtNum(HARD_MAX_WEEKLY_KG, 1)} kg'dan hızlı değişim planlanamaz. En az ${fmtNum(minDays)} gün seçmelisin.`)
    } else if (recommended <= 0) {
      safe = false
      safeDays = 0
      warnings.push('Mevcut harcaman güvenli kalori tabanına çok yakın; bu tempo güvenli değil. Kalori açığı yerine aktiviteyi artırmayı düşün.')
    } else if (wanted > recommended + 0.5) {
      safe = false
      safeDays = Math.ceil(totalKcal / recommended)
      warnings.push(`Haftada ${fmtNum(round2((wanted * 7) / KCAL_PER_KG), 2)} kg önerilen sınırın üstünde, güvenli değil. Önerimiz en az ${fmtNum(safeDays)} gün; yine de seçimin buysa planını bu tempoya göre kurarız.`)
    }
    if (p.goal === 'lose' && diffKg >= 0) warnings.push('Hedef kilo mevcut kilondan düşük olmalı.')
    if (p.goal === 'gain' && diffKg <= 0) warnings.push('Hedef kilo mevcut kilondan yüksek olmalı.')
  }

  let kcal = t + delta
  if (kcal < floor) {
    kcal = floor
    safe = false
    if (p.goal !== 'recomp' && allowed) {
      const realDeficit = t - floor
      const total = Math.abs(p.targetWeightKg - p.weightKg) * KCAL_PER_KG
      expectedDays = realDeficit > 0 ? Math.ceil(total / realDeficit) : null
      warnings.push(`Günlük kalori ${fmtNum(floor)} kcal tabanının altına inmez; bu yüzden ${expectedDays ? `hedefe tahminen ${fmtNum(expectedDays)} günde ulaşırsın` : 'kilo kaybı için aktiviteyi artırman gerekir'}.`)
    }
  }
  const realDelta = kcal - t
  kcal = Math.round(kcal / 5) * 5

  // Protein referans ağırlığı: obezite durumunda VKİ 25'teki ağırlık.
  const h = p.heightCm / 100
  const refWeight = bmi(p.weightKg, p.heightCm) > 30 ? 25 * h * h : p.weightKg
  const proteinPerKg = p.goal === 'gain' ? 1.8 : 2.0
  const proteinG = Math.round(refWeight * proteinPerKg)
  const fatG = Math.round(Math.max((kcal * 0.27) / 9, p.weightKg * 0.6))
  const carbG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))

  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    dailyKcal: kcal,
    dailyDelta: Math.round(realDelta),
    proteinG,
    fatG,
    carbG,
    waterMl: waterTarget(p.weightKg),
    days,
    weeklyKg: round2((Math.abs(realDelta) * 7) / KCAL_PER_KG),
    safe,
    safeDays,
    allowed,
    minDays,
    expectedDays,
    warnings,
  }
}

export function waterTarget(weightKg: number): number {
  return Math.round((weightKg * 33) / 50) * 50
}

export function daysForTempo(currentKg: number, targetKg: number, kgPerWeek: number): number {
  return Math.max(7, Math.ceil((Math.abs(targetKg - currentKg) / kgPerWeek) * 7))
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
