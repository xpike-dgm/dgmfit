// Faz 8: vücut kompozisyonu ve hedefe göre hassas beslenme — saf, testli (tests/body-comp.test.ts).
// Kaynaklar: ABD Donanması çevre ölçüsü formülü (Hodgdon & Beckett 1984), Deurenberg (1991) VKİ tahmini,
// Katch-McArdle BMR, ISSN/ACSM protein önerileri (yağsız kütle başına), WHO doymuş yağ/şeker sınırları,
// Türkiye Beslenme Rehberi (TÜBER 2022) ve IOM DRI mikro besin değerleri.
import type { Sex } from './calc.ts'

export type BodyFatSource = 'user' | 'navy' | 'estimate'
export type Experience = 'new' | 'mid' | 'pro' | null

/** ABD Donanması formülü (cm). Kadında kalça gerekir. Mantıksız ölçüde null. */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipsCm?: number | null): number | null {
  const log10 = Math.log10
  if (sex === 'male') {
    if (!(waistCm > neckCm)) return null
    const bf = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450
    return clampBf(bf)
  }
  if (!hipsCm || !(waistCm + hipsCm > neckCm)) return null
  const bf = 495 / (1.29579 - 0.35004 * log10(waistCm + hipsCm - neckCm) + 0.221 * log10(heightCm)) - 450
  return clampBf(bf)
}

/** Ölçü yoksa VKİ + yaş + cinsiyetten kaba tahmin (Deurenberg) — "düşük güven". */
export function estimateBodyFat(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const bmi = weightKg / (heightCm / 100) ** 2
  return clampBf(1.2 * bmi + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4)!
}

function clampBf(v: number): number | null {
  if (!Number.isFinite(v)) return null
  return Math.round(Math.max(3, Math.min(60, v)) * 10) / 10
}

export const leanMass = (weightKg: number, bfPct: number) => Math.round(weightKg * (1 - bfPct / 100) * 10) / 10
export const bmrKatch = (leanKg: number) => 370 + 21.6 * leanKg

/** Yağ oranı kategorisi (ACE). */
export function bfCategory(sex: Sex, bf: number): string {
  const t = sex === 'male' ? [6, 14, 18, 25] : [14, 21, 25, 32]
  return bf < t[0] ? 'çok düşük' : bf < t[1] ? 'atletik' : bf < t[2] ? 'fit' : bf < t[3] ? 'ortalama' : 'yüksek'
}

/**
 * Kas kazanımı için ideal kilo artışı (ayda vücut ağırlığının yüzdesi) — antrenman geçmişine göre.
 * Yeni başlayan %1–1,5, orta %0,5–1, ileri %0,25–0,5 (Helms ve ark.). Yağ oranı yüksekse alt uç.
 */
export function gainRatePctMonth(exp: Experience, sex: Sex, bf: number | null): { lo: number; hi: number } {
  const r = exp === 'pro' ? { lo: 0.25, hi: 0.5 } : exp === 'mid' ? { lo: 0.5, hi: 1 } : { lo: 1, hi: 1.5 }
  const high = bf !== null && bf > (sex === 'male' ? 20 : 30)
  return high ? { lo: r.lo * 0.5, hi: r.lo } : r
}

export interface MicroTargets {
  fiberG: number; satFatMaxG: number; sugarMaxG: number; sodiumMaxMg: number
  calciumMg: number; ironMg: number; magnesiumMg: number; potassiumMg: number; vitDMcg: number; b12Mcg: number; zincMg: number
}

/** Mikro besin ve sınırlar (yaş/cinsiyet + kaloriye göre). */
export function microTargets(sex: Sex, age: number, kcal: number): MicroTargets {
  const male = sex === 'male'
  return {
    fiberG: Math.round((kcal / 1000) * 14),
    satFatMaxG: Math.round((kcal * 0.1) / 9),
    sugarMaxG: Math.round((kcal * 0.1) / 4),
    sodiumMaxMg: 2300,
    calciumMg: age >= 51 && !male ? 1200 : age >= 71 ? 1200 : age < 19 ? 1300 : 1000,
    ironMg: male ? (age < 19 ? 11 : 8) : age < 19 ? 15 : age < 51 ? 18 : 8,
    magnesiumMg: male ? (age < 19 ? 410 : age < 31 ? 400 : 420) : age < 19 ? 360 : age < 31 ? 310 : 320,
    potassiumMg: male ? 3400 : 2600,
    vitDMcg: age >= 71 ? 20 : 15,
    b12Mcg: 2.4,
    zincMg: male ? 11 : age < 19 ? 9 : 8,
  }
}

export interface MacroPlanInput {
  goal: 'lose' | 'gain' | 'recomp' | 'maintain'
  sex: Sex; age: number; weightKg: number; heightCm: number
  bfPct: number | null
  kcal: number
}

/**
 * Hedefe ve yağsız kütleye göre makrolar. Protein yağsız kütle başına: yağ yakımı 2,6 (2,3–3,1 aralığının ortası),
 * koruyup kas 2,4, kas kazanımı 2,2, bakım 2,0; yağ oranı bilinmiyorsa tahmin kullanılır. Yağ: kalorinin %25'i,
 * en az 0,6 g/kg (hormonlar için), en çok %35. Karbonhidrat kalan kalori.
 */
export function macroPlan(i: MacroPlanInput): { protein: number; fat: number; carb: number; leanKg: number; bfPct: number; bfEstimated: boolean } {
  const bfEstimated = i.bfPct === null
  const bf = i.bfPct ?? estimateBodyFat(i.sex, i.weightKg, i.heightCm, i.age)
  const lean = leanMass(i.weightKg, bf)
  const perLean = i.goal === 'lose' ? 2.6 : i.goal === 'recomp' ? 2.4 : i.goal === 'gain' ? 2.2 : 2.0
  let protein = Math.round(lean * perLean)
  protein = Math.min(protein, Math.round((i.kcal * 0.4) / 4)) // proteinden en çok %40 kalori
  let fat = Math.max(i.weightKg * 0.6, (i.kcal * 0.25) / 9)
  fat = Math.round(Math.min(fat, (i.kcal * 0.35) / 9))
  let carb = Math.round((i.kcal - protein * 4 - fat * 9) / 4)
  if (carb < 0) { fat = Math.max(0, Math.round((i.kcal - protein * 4) / 9)); carb = 0 }
  return { protein, fat, carb, leanKg: lean, bfPct: bf, bfEstimated }
}

/** Koruyup kas kazanma: antrenman günü bakım +%7, dinlenme günü −%12 (haftalık ortalama ≈ bakım). */
export function recompDayKcal(maintenance: number, trainingDay: boolean, trainDaysPerWeek: number): number {
  const t = Math.max(1, Math.min(6, trainDaysPerWeek))
  const up = Math.round(maintenance * 0.07)
  // dinlenme günü düşüşü haftalık toplam sıfır olacak şekilde
  const down = Math.round((up * t) / (7 - t))
  return Math.round((trainingDay ? maintenance + up : maintenance - Math.min(down, Math.round(maintenance * 0.15))) / 5) * 5
}

/** Öğün başına protein: kilogram başına ~0,4 g, 3–5 öğüne. */
export function proteinPerMeal(proteinG: number, weightKg: number): { meals: number; perMealG: number } {
  const per = Math.round(weightKg * 0.4)
  const meals = Math.max(3, Math.min(5, Math.round(proteinG / Math.max(20, per))))
  return { meals, perMealG: Math.round(proteinG / meals) }
}

/**
 * Hedefe ulaşıldı mı: trend kilo son 3 günde hedefin 0,3 kg yakınında ya da ötesinde.
 * (Tek tartı değil; su dalgalanması yanlış alarm vermesin.)
 */
export function goalReached(goal: 'lose' | 'gain' | 'recomp', targetKg: number, trendLast3: (number | null)[]): boolean {
  if (goal === 'recomp' || trendLast3.length < 3 || trendLast3.some((t) => t === null)) return false
  return trendLast3.every((t) => (goal === 'gain' ? t! >= targetKg - 0.3 : t! <= targetKg + 0.3))
}
