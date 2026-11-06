import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bmr, computePlan, ageFromBirthDate, waterTarget, daysForTempo, healthyWeightRange } from '../lib/calc.ts'

test('Mifflin-St Jeor', () => {
  assert.equal(Math.round(bmr('male', 80, 180, 30)), 1780)
  assert.equal(Math.round(bmr('female', 60, 165, 25)), 1345)
})

test('yaş hesabı doğum gününe göre', () => {
  assert.equal(ageFromBirthDate('2000-11-05', new Date('2026-11-04T12:00:00Z')), 25)
  assert.equal(ageFromBirthDate('2000-11-04', new Date('2026-11-04T12:00:00Z')), 26)
})

test('90 günde 78,4 → 72 kg güvenli plan', () => {
  const p = computePlan({ sex: 'male', age: 28, heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'lose', targetWeightKg: 72, days: 90 })
  assert.equal(p.safe, true)
  assert.equal(p.dailyDelta, -548)
  assert.ok(p.dailyKcal > 1500)
  assert.equal(p.dailyKcal % 5, 0)
  const kcalFromMacros = p.proteinG * 4 + p.carbG * 4 + p.fatG * 9
  assert.ok(Math.abs(kcalFromMacros - p.dailyKcal) < 12)
})

test('çok hızlı hedef güvensiz ve alternatif süre önerir', () => {
  const p = computePlan({ sex: 'female', age: 30, heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', targetWeightKg: 60, days: 30 })
  assert.equal(p.safe, false)
  assert.equal(p.allowed, false) // 10 kg / 30 gün = 2,3 kg/hf > 1,5
  assert.equal(p.minDays, 47)
  assert.ok(p.safeDays > 30)
  assert.ok(p.dailyKcal >= 1200)
  // önerilen süreyle plan güvenli olmalı
  const q = computePlan({ sex: 'female', age: 30, heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', targetWeightKg: 60, days: p.safeDays })
  assert.equal(q.safe, true)
})

test('kilo alma fazlası', () => {
  const p = computePlan({ sex: 'male', age: 22, heightCm: 180, weightKg: 61, activity: 'active', goal: 'gain', targetWeightKg: 66, days: 180 })
  assert.ok(p.dailyDelta > 0)
  assert.equal(p.safe, true)
})

test('rekompozisyon: normal yağ oranında bakım, yüksek yağ oranında hafif açık (Faz 8)', () => {
  const p = computePlan({ sex: 'male', age: 30, heightCm: 175, weightKg: 75, activity: 'moderate', goal: 'recomp', targetWeightKg: 75, days: 90, bfPct: 16 })
  assert.equal(p.dailyDelta, 0)
  const h = computePlan({ sex: 'male', age: 30, heightCm: 175, weightKg: 92, activity: 'moderate', goal: 'recomp', targetWeightKg: 92, days: 90, bfPct: 28 })
  assert.ok(h.dailyDelta < 0 && h.dailyDelta > -200)
})

test('kas kazanımı temposu uyarısı deneyime göre (Faz 8)', () => {
  const slow = computePlan({ sex: 'male', age: 27, heightCm: 178, weightKg: 78, activity: 'moderate', goal: 'gain', targetWeightKg: 80, days: 200, experience: 'new', bfPct: 17 })
  assert.ok(slow.warnings.some((w) => w.startsWith('Kas kazanımı için yavaş')), slow.warnings.join(' | '))
  const fast = computePlan({ sex: 'male', age: 27, heightCm: 178, weightKg: 78, activity: 'moderate', goal: 'gain', targetWeightKg: 84, days: 60, experience: 'adv', bfPct: 12 })
  assert.ok(fast.warnings.some((w) => w.startsWith('Kas kazanımı için hızlı')), fast.warnings.join(' | '))
  const ok = computePlan({ sex: 'male', age: 27, heightCm: 178, weightKg: 78, activity: 'moderate', goal: 'gain', targetWeightKg: 80, days: 75, experience: 'new', bfPct: 15 })
  assert.ok(!ok.warnings.some((w) => w.startsWith('Kas kazanımı')), ok.warnings.join(' | '))
})

test('su ve tempo', () => {
  assert.equal(waterTarget(78.4), 2600)
  assert.equal(daysForTempo(78.4, 72, 0.5), 90)
  assert.deepEqual(healthyWeightRange(177), [58, 78])
})

test('kullanıcının seçtiği güvensiz tempo kabul edilir, uyarılır; 1,5 kg/hf üstü kabul edilmez', () => {
  // ekran görüntüsündeki durum: kilo alma, haftada 1,2 kg
  const g = computePlan({ sex: 'male', age: 25, heightCm: 178, weightKg: 70, activity: 'moderate', goal: 'gain', targetWeightKg: 82, days: 70 })
  assert.equal(g.safe, false)
  assert.equal(g.allowed, true)
  assert.equal(g.weeklyKg, 1.2)
  assert.ok(g.warnings[0].includes('güvenli değil'))
  assert.ok(g.safeDays > 70)
  const h = computePlan({ sex: 'male', age: 25, heightCm: 178, weightKg: 70, activity: 'moderate', goal: 'gain', targetWeightKg: 82, days: 50 })
  assert.equal(h.allowed, false) // 12 kg / 50 gün = 1,68 kg/hf
  assert.equal(h.minDays, 56)
  assert.equal(computePlan({ sex: 'male', age: 25, heightCm: 178, weightKg: 70, activity: 'moderate', goal: 'gain', targetWeightKg: 82, days: h.minDays }).allowed, true)
})

test('kalori tabanı korunur, gerçek tempo ve tahmini süre buna göre', () => {
  // 1,45 kg/hf açık istenir ama taban 1.200 kcal → gerçek açık daha küçük
  const p = computePlan({ sex: 'female', age: 30, heightCm: 160, weightKg: 62, activity: 'sedentary', goal: 'lose', targetWeightKg: 56, days: 29 })
  assert.equal(p.allowed, true)
  assert.equal(p.dailyKcal, 1200)
  assert.ok(p.weeklyKg < 1.45)
  assert.ok(p.expectedDays !== null && p.expectedDays > 29)
  assert.ok(p.warnings.some((w) => w.includes('tabanının altına inmez')))
})

test('18 yaş altında önerilen sınır mutlak sınırdır', () => {
  const p = computePlan({ sex: 'male', age: 17, heightCm: 175, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 74, days: 49 })
  assert.equal(p.allowed, false) // 6 kg / 7 hf = 0,86 kg/hf > 0,8 (ağırlığın %1'i)
})
