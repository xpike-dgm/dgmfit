import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemsMacros, rankDishes, scaleToKcal, shoppingList, aisleOf } from '../lib/menu.ts'
import { carbCycleDay, simulate } from '../lib/scenario.ts'
import { checkProgram, clampTargets, maxExercises, type ResolvedEx } from '../lib/ai-program.ts'

const P = (kcal: number, protein = 0) => ({ kcal, protein, carb: 0, fat: 0 })

test('menü: gün hedef kaloriye ölçeklenir, sınırda kalır', () => {
  const items = [{ name: 'a', foodId: 1, grams: 200, per100: P(100, 10) }, { name: 'b', foodId: 2, grams: 100, per100: P(200) }, { name: 'x', foodId: null, grams: 50, per100: null }]
  assert.equal(itemsMacros(items).kcal, 400)
  const r = scaleToKcal(items, 480)
  assert.equal(r.factor, 1.2)
  assert.deepEqual(r.items.map((i) => i.grams), [240, 120, 50]) // eşleşmeyen kalem değişmez
  assert.equal(r.macros.kcal, 480)
  assert.equal(r.off, 0)
  const lim = scaleToKcal(items, 1000) // 2,5 kat istenir, 1,35'te durur
  assert.equal(lim.factor, 1.35)
  assert.ok(lim.off < 0)
})

test('alışveriş: yemek malzemelerine açılır, birleşir, reyonlara ayrılır', () => {
  const cat = (k: string) => ({ yumurta: 'Yumurta', domates: 'Sebzeler', zeytinyagi: 'Yağlar', su: null } as Record<string, string | null>)[k] ?? null
  const menemen = { yield: 500, ingredients: [{ g: 200, key: 'yumurta', name: 'Yumurta' }, { g: 300, key: 'domates', name: 'Domates' }, { g: 20, key: 'zeytinyagi', name: 'Zeytinyağı' }, { g: 100, key: 'su', name: 'Su' }] }
  const l = shoppingList([{ name: 'Menemen', grams: 250, category: 'Kahvaltılık', recipe: menemen }, { name: 'Domates', grams: 120, category: 'Sebzeler', recipe: null }, { name: 'Yumurta', grams: 50, category: 'Yumurta', recipe: null }], cat)
  assert.deepEqual(l, [
    { name: 'Domates', grams: 270, aisle: 'Manav' }, // 150 + 120
    { name: 'Yumurta', grams: 150, aisle: 'Süt ürünleri ve kahvaltılık' }, // 100 + 50
    { name: 'Zeytinyağı', grams: 10, aisle: 'Yağ, sos ve baharat' },
  ])
  assert.equal(aisleOf('Bilinmeyen'), 'Diğer')
})

test('restoran: bütçeye uyan ve proteini yüksek önde, aşanlar sonra', () => {
  const r = rankDishes([
    { name: 'Lahmacun', food: 'Lahmacun', grams: 180, kcal: 420, protein: 18 },
    { name: 'Izgara köfte', food: 'Izgara köfte', grams: 200, kcal: 480, protein: 36 },
    { name: 'İskender', food: null, grams: 400, kcal: 900, protein: 45 },
    { name: 'Bilinmeyen', food: null, grams: 100, kcal: null, protein: null },
  ], 600)
  assert.deepEqual(r.map((x) => x.name), ['Izgara köfte', 'Lahmacun', 'İskender'])
  assert.equal(r[2].fits, false)
  assert.equal(r[2].over, 300)
})

test('senaryo: ek koşu ve kalori değişikliği → tempo ve tarih; güvenlik uyarısı', () => {
  const base = { goal: 'lose' as const, currentKg: 80, targetKg: 75, tdee: 2500, dailyKcal: 2000, floor: 1500, today: '2026-11-05' }
  const s0 = simulate(base)
  assert.equal(s0.dailyBalance, -500)
  assert.equal(s0.kgPerWeek, -0.45)
  assert.equal(s0.days, Math.ceil(5 / (0.45 / 7)))
  const s1 = simulate({ ...base, extra: { type: 'run', minutes: 30, perWeek: 2 } })
  assert.ok(s1.extraBurnPerDay > 0 && s1.days! < s0.days!)
  const s2 = simulate({ ...base, kcalDelta: -700 })
  assert.match(s2.warnings.join(' '), /tabanın/)
  assert.equal(simulate({ ...base, kcalDelta: 800 }).days, null) // yanlış yön
})

test('karb döngüsü: haftalık karbonhidrat korunur, dinlenme tabanı', () => {
  const base = { kcal: 2000, protein: 140, carb: 200, fat: 60 }
  const t = carbCycleDay(base, true, 3, 40), r = carbCycleDay(base, false, 3, 40)
  assert.equal(t.carb, 240); assert.equal(t.kcal, 2160)
  assert.equal(r.carb, 170); assert.equal(r.kcal, 1880)
  assert.equal(3 * t.carbDelta + 4 * r.carbDelta, 0)
  const low = carbCycleDay({ ...base, carb: 80 }, false, 5, 40) // 80 − 100 < 50 → kaydırma küçülür
  assert.ok(low.carb >= 50)
  assert.equal(carbCycleDay(base, true, 0, 40).carbDelta, 0)
})

const ex = (id: number, name: string, primary: string[], o: Partial<ResolvedEx> = {}): ResolvedEx => ({ exerciseId: id, key: 'k' + id, nameTr: name, name, kind: 'weight_reps', equipment: 'barbell', primary, secondary: [], sets: 3, repMin: 8, repMax: 12, rir: 2, rest: 90, ...o })

test('AI program: sınırlar, ekipman, tekrar, süre ve hacim uyarıları', () => {
  assert.deepEqual(clampTargets({ name: 'x', sets: 8, repMin: 1, repMax: 50, rir: 0, rest: 10 }, 'weight_reps', 'new'), { name: 'x', sets: 4, repMin: 3, repMax: 30, rir: 1, rest: 30 })
  assert.equal(clampTargets({ name: 'p', sets: 3, repMin: 10, repMax: 12, rir: 2, rest: 60 }, 'time', 'mid').repMax, 1)
  assert.equal(maxExercises(45), 5)
  const sq = ex(1, 'Squat', ['quadriceps']), bp = ex(2, 'Bench', ['chest']), cab = ex(3, 'Kablo', ['chest'], { equipment: 'cable' })
  const c = checkProgram({
    days: [{ name: 'A', focus: 'Tam vücut', exercises: [sq, sq, bp, cab, { unresolved: 'Uçan halı' }] }, { name: 'B', focus: '', exercises: [sq, bp] }, { name: 'C', focus: '', exercises: [] }],
    wantDays: 2, minutes: 45, exp: 'mid', equipment: new Set(['barbell']), weak: ['hamstrings'],
  })
  assert.equal(c.days.length, 2)
  assert.deepEqual(c.days[0].exercises.map((e) => e.nameTr), ['Squat', 'Bench'])
  assert.deepEqual(c.dropped, ['Kablo (ekipman yok)', 'Uçan halı (kütüphanede yok)'])
  assert.equal(c.weekly.quadriceps, 6)
  assert.match(c.warnings.join(' '), /Arka bacak/)
})
