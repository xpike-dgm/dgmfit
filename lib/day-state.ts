// Faz 7-1: "Bugünün durumu" — günün hedefleri ile yenen/yakılan/içileni birleştiren saf hesap.
// Bugün, Yemek, Su ve Fit aynı sayıyı bu fonksiyondan okur; ekranlar arası tutarlılık testinin dayanağı.

export interface DayStateInput {
  target: { kcal: number; protein: number; carb: number; fat: number; water: number }
  eaten: { kcal: number; protein: number; carb: number; fat: number }
  /** Antrenman + kardiyo net kalorisi (bütçeye eklenir) */
  burned: number
  waterMl: number
  /** Antrenmandan gelen su hedefi eki (ml) */
  waterBonus: number
  /** Bugün tamamlanan ağırlık antrenmanı (dakika); yoksa 0 */
  workoutMin: number
  /** Son antrenmanın bitişinden bu yana dakika (yoksa null) */
  sinceWorkoutMin: number | null
  /** Günün dakikası (00:00'dan) */
  nowMin: number
}

export interface DayState {
  budget: number
  left: { kcal: number; protein: number; carb: number; fat: number; water: number }
  pct: { kcal: number; protein: number; water: number }
  /** Antrenman sonrası (son 3 saat) protein açığı ≥ 20 g ise öneri */
  postWorkoutProtein: { gapG: number; text: string } | null
  waterBonusText: string | null
}

const r = (n: number) => Math.round(n)

export function dayState(i: DayStateInput): DayState {
  const budget = i.target.kcal + i.burned
  const left = {
    kcal: r(budget - i.eaten.kcal),
    protein: r(i.target.protein - i.eaten.protein),
    carb: r(i.target.carb - i.eaten.carb),
    fat: r(i.target.fat - i.eaten.fat),
    water: r(i.target.water - i.waterMl),
  }
  const pct = {
    kcal: budget > 0 ? i.eaten.kcal / budget : 0,
    protein: i.target.protein > 0 ? i.eaten.protein / i.target.protein : 0,
    water: i.target.water > 0 ? i.waterMl / i.target.water : 0,
  }
  let postWorkoutProtein: DayState['postWorkoutProtein'] = null
  if (i.workoutMin > 0 && i.sinceWorkoutMin !== null && i.sinceWorkoutMin <= 180 && left.protein >= 20) {
    const now = Math.min(left.protein, 40) // tek öğünde ~30–40 g yeterli
    postWorkoutProtein = { gapG: left.protein, text: `Antrenman sonrası: bugün ${left.protein} g protein eksiğin var. Şimdi ${now} g almak toparlanmayı destekler.` }
  }
  const waterBonusText = i.waterBonus > 0 ? `Antrenman nedeniyle su hedefin +${i.waterBonus} ml` : null
  return { budget, left, pct, postWorkoutProtein, waterBonusText }
}
