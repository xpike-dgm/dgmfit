import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateBodyFat, gainRatePctMonth, goalReached, leanMass, macroPlan, microTargets, navyBodyFat, proteinPerMeal, recompDayKcal } from '../lib/body-comp.ts'
import { dayState } from '../lib/day-state.ts'

test('Donanma formülü: bilinen örnekler makul aralıkta', () => {
  const m = navyBodyFat('male', 180, 38, 85)! // ortalama erkek
  assert.ok(m > 14 && m < 20, String(m))
  const f = navyBodyFat('female', 165, 33, 75, 100)!
  assert.ok(f > 24 && f < 34, String(f))
  assert.equal(navyBodyFat('male', 180, 40, 39), null, 'bel boyundan küçükse hesap yok')
  assert.equal(navyBodyFat('female', 165, 33, 75, null), null, 'kadında kalça gerekir')
  assert.equal(navyBodyFat('male', 180, 38, 38.1), null, 'bel boyundan yalnızca 0,1 cm büyük: ölçü hatası, %3 diye kaydedilmez')
})

test('Deurenberg tahmini ve yağsız kütle', () => {
  const bf = estimateBodyFat('male', 80, 180, 30)
  assert.ok(bf > 15 && bf < 22, String(bf))
  assert.equal(leanMass(80, 20), 64)
})

test('makro planı: protein yağsız kütleden, yağ ≥ 0,6 g/kg, toplam kaloriyle tutarlı', () => {
  for (const goal of ['lose', 'gain', 'recomp', 'maintain'] as const) {
    const m = macroPlan({ goal, sex: 'male', age: 30, weightKg: 80, heightCm: 180, bfPct: 18, kcal: goal === 'lose' ? 2200 : 2800 })
    const kcal = m.protein * 4 + m.carb * 4 + m.fat * 9
    assert.ok(Math.abs(kcal - (goal === 'lose' ? 2200 : 2800)) <= 6, `${goal}: ${kcal}`)
    assert.ok(m.fat >= 48, `${goal} yağ ${m.fat}`)
    assert.ok(m.protein >= 65.6 * 2 - 1, `${goal} protein ${m.protein}`)
  }
  const cut = macroPlan({ goal: 'lose', sex: 'male', age: 30, weightKg: 80, heightCm: 180, bfPct: 18, kcal: 2200 })
  const bulk = macroPlan({ goal: 'gain', sex: 'male', age: 30, weightKg: 80, heightCm: 180, bfPct: 18, kcal: 2800 })
  assert.ok(cut.protein > bulk.protein, 'açıkta kası korumak için protein daha yüksek')
  const est = macroPlan({ goal: 'gain', sex: 'female', age: 25, weightKg: 60, heightCm: 165, bfPct: null, kcal: 2200 })
  assert.equal(est.bfEstimated, true)
})

test('kas kazanım temposu deneyime göre; yağ oranı yüksekse yavaşlar', () => {
  assert.deepEqual(gainRatePctMonth('new', 'male', 15), { lo: 1, hi: 1.5 })
  assert.deepEqual(gainRatePctMonth('adv', 'male', 12), { lo: 0.25, hi: 0.5 })
  assert.ok(gainRatePctMonth('new', 'male', 26).hi <= 1)
})

test('mikro besinler ve sınırlar', () => {
  const m = microTargets('female', 30, 2000)
  assert.equal(m.fiberG, 28); assert.equal(m.satFatMaxG, 22); assert.equal(m.sugarMaxG, 50); assert.equal(m.ironMg, 18)
  assert.equal(microTargets('male', 30, 2500).ironMg, 8)
})

test('koruyup kas: antrenman günü fazla, dinlenme günü az; haftalık ortalama ≈ bakım', () => {
  const tr = recompDayKcal(2600, true, 4), rest = recompDayKcal(2600, false, 4)
  assert.ok(tr > 2600 && rest < 2600)
  const avg = (tr * 4 + rest * 3) / 7
  assert.ok(Math.abs(avg - 2600) <= 15, String(avg))
})

test('öğün başına protein ve hedefe ulaşma (trend, 3 gün)', () => {
  assert.deepEqual(proteinPerMeal(160, 80), { meals: 5, perMealG: 32 })
  assert.equal(goalReached('gain', 80, [79.8, 79.9, 80.1]), true)
  assert.equal(goalReached('gain', 80, [79.5, 79.9, 80.1]), false)
  assert.equal(goalReached('lose', 70, [70.2, 70.1, 69.9]), true)
  assert.equal(goalReached('recomp', 80, [80, 80, 80]), false)
})

test('günün durumu: kalan, antrenman sonrası protein, su bonusu', () => {
  const s = dayState({ target: { kcal: 2200, protein: 150, carb: 220, fat: 70, water: 3000 }, eaten: { kcal: 1200, protein: 60, carb: 120, fat: 40 }, burned: 300, waterMl: 1500, waterBonus: 500, workoutMin: 60, sinceWorkoutMin: 30, nowMin: 18 * 60 })
  assert.equal(s.budget, 2500); assert.equal(s.left.kcal, 1300); assert.equal(s.left.protein, 90); assert.equal(s.left.water, 1500)
  assert.ok(s.postWorkoutProtein && s.postWorkoutProtein.gapG === 90)
  assert.match(s.waterBonusText!, /\+500 ml/)
  const late = dayState({ target: { kcal: 2200, protein: 150, carb: 220, fat: 70, water: 3000 }, eaten: { kcal: 1200, protein: 140, carb: 120, fat: 40 }, burned: 0, waterMl: 0, waterBonus: 0, workoutMin: 60, sinceWorkoutMin: 30, nowMin: 600 })
  assert.equal(late.postWorkoutProtein, null, 'protein açığı 20 g altında kart yok')
})

test('kazanım kalitesi: hızlı / yavaş / iyi / recomp / kas kaybı', async () => {
  const { gainQuality } = await import('../lib/body-comp.ts')
  const rate = { lo: 1, hi: 1.5 }
  assert.equal(gainQuality({ goal: 'gain', weightKg: 78, weeklyKg: 0.5, rate, waistDeltaCm: 1, strengthDeltaPct: 5 }).verdict, 'fast')
  assert.equal(gainQuality({ goal: 'gain', weightKg: 78, weeklyKg: 0.05, rate, waistDeltaCm: 0, strengthDeltaPct: 0 }).verdict, 'slow')
  assert.equal(gainQuality({ goal: 'gain', weightKg: 78, weeklyKg: 0.22, rate, waistDeltaCm: 0.5, strengthDeltaPct: 4 }).verdict, 'good')
  assert.equal(gainQuality({ goal: 'recomp', weightKg: 80, weeklyKg: 0.01, rate, waistDeltaCm: -0.5, strengthDeltaPct: 3 }).verdict, 'good')
  assert.equal(gainQuality({ goal: 'lose', weightKg: 90, weeklyKg: -0.6, rate, waistDeltaCm: -2, strengthDeltaPct: -8 }).verdict, 'cut-muscle')
  assert.equal(gainQuality({ goal: 'gain', weightKg: 78, weeklyKg: null, rate, waistDeltaCm: null, strengthDeltaPct: null }).verdict, 'unknown')
})

test('recompDayKcal: haftalık ortalama 1–6 antrenman gününde bakıma eşit (±5 kcal yuvarlama)', () => {
  for (const m of [1800, 2400, 3200]) for (let t = 1; t <= 6; t++) {
    const avg = (recompDayKcal(m, true, t) * t + recompDayKcal(m, false, t) * (7 - t)) / 7
    assert.ok(Math.abs(avg - m) <= 5, `${m} kcal, ${t} gün: ortalama ${avg}`)
    assert.ok(recompDayKcal(m, false, t) >= m * 0.85 - 3, 'dinlenme günü en fazla %15 düşer')
  }
})
