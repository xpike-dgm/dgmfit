// Senaryo simülatörü ve karb döngüsü — saf, testli (tests/planner.test.ts). Spesifikasyon 5.6.
import { KCAL_PER_KG, maxWeeklyKg, type GoalType } from './calc.ts'
import { cardioKcal, type CardioType, type Intensity } from './training.ts'

export interface ScenarioInput {
  goal: GoalType
  currentKg: number
  targetKg: number
  tdee: number // ölçülen (adaptif) harcama, yoksa plan TDEE'si
  dailyKcal: number // şu anki günlük hedef
  floor: number
  today: string
  extra?: { type: CardioType; minutes: number; perWeek: number; intensity?: Intensity } | null
  kcalDelta?: number // günlük kalori değişikliği (−: daha az ye)
}
export interface ScenarioOut {
  extraBurnPerDay: number
  intake: number
  dailyBalance: number // − açık, + fazla
  kgPerWeek: number // işaretli: − kayıp
  days: number | null // hedefe kalan gün; yanlış yöndeyse null
  date: string | null
  warnings: string[]
}

const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10)

/** "Haftada 2 gün daha koşarsam hedefe ne zaman ulaşırım?" — enerji dengesi (7700 kcal/kg) ve MET ile. */
export function simulate(i: ScenarioInput): ScenarioOut {
  const warnings: string[] = []
  const ex = i.extra && i.extra.minutes > 0 && i.extra.perWeek > 0 ? cardioKcal({ type: i.extra.type, minutes: i.extra.minutes, weightKg: i.currentKg, intensity: i.extra.intensity ?? 'orta' }).net * i.extra.perWeek : 0
  const extraBurnPerDay = Math.round(ex / 7)
  const intake = Math.round(i.dailyKcal + (i.kcalDelta ?? 0))
  const dailyBalance = intake - (i.tdee + extraBurnPerDay)
  const kgPerWeek = Math.round(((dailyBalance * 7) / KCAL_PER_KG) * 100) / 100
  if (intake < i.floor) warnings.push(`Günlük ${intake} kcal güvenli tabanın (${i.floor} kcal) altında; bu senaryo önerilmez.`)
  const maxRate = maxWeeklyKg(i.goal, i.currentKg)
  if (i.goal === 'lose' && -kgPerWeek > maxRate + 0.005) warnings.push(`Haftada ${String(Math.abs(kgPerWeek)).replace('.', ',')} kg kayıp, güvenli sınırın (vücut ağırlığının %1'i) üstünde.`)
  if (i.goal === 'gain' && kgPerWeek > maxRate + 0.005) warnings.push('Bu hızda kilo almak yağ artışını hızlandırır; haftada vücut ağırlığının %0,5\'i önerilir.')
  const diff = i.targetKg - i.currentKg
  let days: number | null = null
  if (i.goal !== 'recomp' && Math.abs(diff) >= 0.05 && kgPerWeek !== 0 && Math.sign(kgPerWeek) === Math.sign(diff)) days = Math.ceil(Math.abs(diff) / (Math.abs(kgPerWeek) / 7))
  if (days !== null && days > 3650) days = null
  return { extraBurnPerDay, intake, dailyBalance: Math.round(dailyBalance), kgPerWeek, days, date: days === null ? null : addDays(i.today, days), warnings }
}

// ───────── Karb döngüsü ─────────

export const CARB_SHIFT = { min: 10, max: 100, def: 40 }
export const REST_CARB_MIN = 50

/**
 * Antrenman günü karbonhidrat +shift g; dinlenme günleri haftalık toplamı koruyacak kadar azalır
 * (shift × antrenman günü / dinlenme günü). Protein ve yağ sabit; kalori karbonhidrat farkı × 4 kadar değişir.
 * Dinlenme günü karbonhidratı 50 g'ın altına inmez (o durumda kaydırma küçültülür).
 */
export function carbCycleDay(base: { kcal: number; protein: number; carb: number; fat: number }, training: boolean, nTraining: number, shiftG: number) {
  const n = Math.max(0, Math.min(7, Math.round(nTraining)))
  if (n === 0 || n === 7 || shiftG <= 0) return { ...base, carbDelta: 0 }
  let shift = Math.min(CARB_SHIFT.max, Math.round(shiftG))
  const restDrop = (s: number) => (s * n) / (7 - n)
  if (base.carb - restDrop(shift) < REST_CARB_MIN) shift = Math.max(0, Math.floor(((base.carb - REST_CARB_MIN) * (7 - n)) / n))
  const d = training ? shift : -Math.round(restDrop(shift))
  return { kcal: base.kcal + d * 4, protein: base.protein, carb: base.carb + d, fat: base.fat, carbDelta: d }
}
