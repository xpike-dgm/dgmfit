// Sanal vücut: uygulamanın hesaplarından BAĞIMSIZ bir "gerçek" fizyoloji modeli. Uygulama bu vücudun gerçek
// harcamasını bilmez; yalnızca kullanıcının girdiği kayıtları ve tartıları görür (gerçek hayattaki gibi).
//
// Kaynak yaklaşımlar (basitleştirilmiş): Katch-McArdle BMR (yağsız kütleden), Forbes eğrisi (kilo değişiminin
// yağsız kütle payı), Hall (yağ ~9.400 kcal/kg, yağsız doku ~1.800 kcal/kg enerji yoğunluğu), uyumsal termogenez
// (açıkta harcama birkaç haftada %5–10'a kadar düşer), glikojen/su dalgalanması ve tartı gürültüsü.
import type { Rng } from './rng.ts'

export type Training = 'none' | 'novice' | 'intermediate' | 'advanced'

export interface BodyInit {
  sex: 'male' | 'female'; age: number; heightCm: number; weightKg: number; bodyFatPct: number
  /** Antrenman dışı gerçek hareket katsayısı (uygulamaya girilenle aynı olmak zorunda değil) */
  activityFactor: number
  /** Kişinin metabolizmasının ortalamadan sapması (ör. 0,92 = %8 düşük) */
  metabolicBias: number
  training: Training
}

export interface Body {
  fatKg: number; leanKg: number; glyKg: number; adapt: number; daysTrained: number
  init: BodyInit
}

export const FAT_KCAL = 9400
export const LEAN_KCAL = 1800

export function makeBody(i: BodyInit): Body {
  const fatKg = (i.weightKg * i.bodyFatPct) / 100
  return { fatKg, leanKg: i.weightKg - fatKg, glyKg: 0, adapt: 0, daysTrained: 0, init: i }
}

export const weightOf = (b: Body) => b.fatKg + b.leanKg + b.glyKg
export const bodyFatOf = (b: Body) => (100 * b.fatKg) / (b.fatKg + b.leanKg)

/** Gerçek günlük harcama (antrenman hariç): Katch-McArdle × hareket × kişisel sapma + uyum. */
export function trueTdee(b: Body): number {
  const bmr = 370 + 21.6 * b.leanKg
  return bmr * b.init.activityFactor * b.init.metabolicBias + b.adapt
}

/** Ayda en fazla kazanılabilecek yağsız kütle (kg) — antrenman geçmişine göre, zamanla azalır. */
function leanCapPerDay(b: Body): number {
  const base = { none: 0, novice: 1.0, intermediate: 0.5, advanced: 0.25 }[b.init.training]
  const sexF = b.init.sex === 'female' ? 0.55 : 1
  const decay = b.init.training === 'novice' ? Math.max(0.45, 1 - b.daysTrained / 500) : 1
  return (base * sexF * decay) / 30
}

/**
 * Bir gün: gerçek alım ve egzersiz harcamasıyla vücut değişir. `trainedToday`: ağırlık antrenmanı yapıldı.
 * `proteinOk`: protein hedefe yakın (kas kazanımı için gerekli).
 */
export function stepBody(b: Body, intakeKcal: number, exerciseKcal: number, trainedToday: boolean, proteinOk: boolean, r: Rng): void {
  const tdee = trueTdee(b) + exerciseKcal
  const E = intakeKcal - tdee
  // uyumsal termogenez: dengesizliğin ~%15'i, ~2 haftalık gecikmeyle; harcamanın %10'uyla sınırlı
  const cap = 0.1 * (370 + 21.6 * b.leanKg) * b.init.activityFactor
  b.adapt += (Math.max(-cap, Math.min(cap, 0.15 * E)) - b.adapt) / 14
  if (trainedToday) b.daysTrained++
  // yağsız kütle değişimi
  let dL: number
  const lifts = b.init.training !== 'none'
  if (lifts && proteinOk) {
    const capL = leanCapPerDay(b) * (trainedToday ? 2.2 : 0.5) // antrenman günleri sentez yüksek, haftalık ortalama ≈ kapasite
    const f = E >= 300 ? 1 : E >= 0 ? 0.55 + (0.45 * E) / 300 : E >= -500 ? 0.55 + (0.55 * E) / 500 : Math.max(-0.4, (E + 500) / 1250)
    dL = capL * f
  } else {
    const p = 10.4 / (10.4 + b.fatKg) // Forbes: yağ azsa değişimin çoğu yağsız dokudan
    const share = lifts ? p * 0.6 : p
    dL = (share * E) / (share * LEAN_KCAL + (1 - share) * FAT_KCAL)
  }
  const dF = (E - dL * LEAN_KCAL) / FAT_KCAL
  b.leanKg = Math.max(b.leanKg * 0.6, b.leanKg + dL)
  b.fatKg = Math.max(1.5, b.fatKg + dF)
  // glikojen + su: alım/harcama dengesine 3 günlük gecikmeyle (±1,2 kg)
  const gTarget = Math.max(-1.2, Math.min(1.2, E / 900))
  b.glyKg += (gTarget - b.glyKg) / 3 + r.normal(0, 0.05)
}

/** Tartının gösterdiği: gerçek kilo + günlük su/tuz/sindirim dalgalanması. */
export function scaleReading(b: Body, r: Rng): number {
  return Math.round((weightOf(b) + r.normal(0, 0.35)) * 10) / 10
}
