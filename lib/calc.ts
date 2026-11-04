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
  warnings: string[]
}

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

  if (p.goal === 'recomp') {
    delta = -Math.round(t * 0.05)
  } else {
    const diffKg = p.targetWeightKg - p.weightKg
    const totalKcal = Math.abs(diffKg) * KCAL_PER_KG
    const wanted = totalKcal / days
    const maxByRate = (maxWeeklyKg(p.goal, p.weightKg) * KCAL_PER_KG) / 7
    let allowed = maxByRate
    if (p.goal === 'lose') {
      allowed = Math.min(allowed, Math.max(0, t - floor))
      if (p.age < 18) allowed = Math.min(allowed, t * 0.2)
    }
    if (allowed <= 0) {
      safe = false
      safeDays = 0
      warnings.push('Mevcut harcaman güvenli kalori tabanına çok yakın; kalori açığı yerine aktiviteyi artırmayı düşün.')
      delta = 0
    } else if (wanted > allowed + 0.5) {
      safe = false
      safeDays = Math.ceil(totalKcal / allowed)
      delta = (p.goal === 'lose' ? -1 : 1) * wanted
      warnings.push(`Bu hedef ${days} günde güvenli değil. En az ${safeDays} gün öneriyoruz.`)
    } else {
      delta = (p.goal === 'lose' ? -1 : 1) * wanted
    }
    if (p.goal === 'lose' && diffKg >= 0) warnings.push('Hedef kilo mevcut kilondan düşük olmalı.')
    if (p.goal === 'gain' && diffKg <= 0) warnings.push('Hedef kilo mevcut kilondan yüksek olmalı.')
  }

  let kcal = t + delta
  if (kcal < floor) {
    kcal = floor
    safe = false
  }
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
    dailyDelta: Math.round(delta),
    proteinG,
    fatG,
    carbG,
    waterMl: waterTarget(p.weightKg),
    days,
    weeklyKg: round2((Math.abs(delta) * 7) / KCAL_PER_KG),
    safe,
    safeDays,
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
