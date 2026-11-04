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

test('rekompozisyon hafif açık', () => {
  const p = computePlan({ sex: 'male', age: 30, heightCm: 175, weightKg: 75, activity: 'moderate', goal: 'recomp', targetWeightKg: 75, days: 90 })
  assert.ok(p.dailyDelta < 0 && p.dailyDelta > -200)
})

test('su ve tempo', () => {
  assert.equal(waterTarget(78.4), 2600)
  assert.equal(daysForTempo(78.4, 72, 0.5), 90)
  assert.deepEqual(healthyWeightRange(177), [58, 78])
})
