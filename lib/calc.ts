// DgFit hesaplama motoru — saf fonksiyonlar (sunucu ve istemcide aynı sonuç).
import { estimateBodyFat, gainRatePctMonth, macroPlan } from './body-comp.ts'

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type GoalType = 'lose' | 'gain' | 'recomp'

export const KCAL_PER_KG = 7700

// Açıklamalar antrenman dışındaki günlük hareketi anlatır; antrenman ve kardiyo kalorisi ayrıca bütçeye eklenir.
export const ACTIVITY: Record<Activity, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Hareketsiz', hint: 'Masa başı iş, gün içinde az yürüyüş' },
  light: { factor: 1.375, label: 'Az hareketli', hint: 'Çoğunlukla oturarak; günde 30–60 dk yürüyüş' },
  moderate: { factor: 1.55, label: 'Orta hareketli', hint: 'Gün boyu ayakta ya da sık yürüyen iş (öğretmen, satış)' },
  active: { factor: 1.725, label: 'Çok hareketli', hint: 'Fiziksel iş (garson, kurye, depo)' },
  very_active: { factor: 1.9, label: 'Aşırı hareketli', hint: 'Ağır fiziksel iş (inşaat, tarım)' },
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
  /** Faz 8: bilinen yağ oranı (%) — yoksa VKİ'den tahmin edilir */
  bfPct?: number | null
  /** Faz 8: antrenman deneyimi (new | mid | pro) — kas kazanım temposu için */
  experience?: string | null
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
    // Faz 8: haftalık ortalama bakım (antrenman günü fazla, dinlenme günü az — dayTargets); yağ oranı yüksekse hafif açık
    const bf = p.bfPct ?? estimateBodyFat(p.sex, p.weightKg, p.heightCm, p.age)
    delta = bf > (p.sex === 'male' ? 22 : 32) ? -Math.round(t * 0.05) : 0
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

  // Faz 8: makrolar yağsız kütleye göre (lib/body-comp.ts macroPlan) — yağ oranı bilinmiyorsa tahmin
  const mp = macroPlan({ goal: p.goal, sex: p.sex, age: p.age, weightKg: p.weightKg, heightCm: p.heightCm, bfPct: p.bfPct ?? null, kcal })
  const proteinG = mp.protein, fatG = mp.fat, carbG = mp.carb
  // Kas kazanımı temposu (deneyime göre): çok hızlıysa fazlası yağ olabilir, çok yavaşsa kazanım düşük kalır
  if (p.goal === 'gain' && p.targetWeightKg > p.weightKg) {
    const exp = p.experience === 'adv' || p.experience === 'mid' || p.experience === 'new' ? p.experience : 'new'
    const r = gainRatePctMonth(exp, p.sex, mp.bfPct)
    const pctMonth = ((Math.abs(realDelta) * 30.4) / KCAL_PER_KG / p.weightKg) * 100
    const daysFor = (pct: number) => Math.ceil(((p.targetWeightKg - p.weightKg) / ((p.weightKg * pct) / 100)) * 30.4)
    if (pctMonth > r.hi * 1.05) warnings.push(`Kas kazanımı için hızlı: ayda kilonun %${fmtNum(round2(pctMonth), 2)}'i. Senin deneyiminde önerilen %${fmtNum(r.lo, 2)}–${fmtNum(r.hi, 2)}; fazlası yağ olarak birikebilir. Önerilen süre en az ${fmtNum(daysFor(r.hi))} gün.`)
    else if (pctMonth < r.lo * 0.6) warnings.push(`Kas kazanımı için yavaş: ayda kilonun %${fmtNum(round2(pctMonth), 2)}'i. Senin deneyiminde %${fmtNum(r.lo, 2)}–${fmtNum(r.hi, 2)} önerilir (yaklaşık ${fmtNum(daysFor(r.lo))}–${fmtNum(daysFor(r.hi))} gün). Daha uzun süre de olur; hedefe erken ulaşırsan uygulama sana sonraki adımı sorar.`)
  }

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
