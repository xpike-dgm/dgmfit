import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAchievements, foodStreak, mondayOf, trainingWeekStreak } from '../lib/achievements.ts'

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => { const x = new Date(from + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(0, 10) })

test('mondayOf', () => {
  assert.equal(mondayOf('2026-11-08'), '2026-11-02') // pazar
  assert.equal(mondayOf('2026-11-02'), '2026-11-02')
})

test('foodStreak: bugün kayıt yoksa dünden sayılır; 1 kalemli gün seriyi bozar', () => {
  const f = days('2026-11-01', 6).map((d) => ({ day: d, items: 3 }))
  assert.equal(foodStreak(f, '2026-11-07'), 6)
  assert.equal(foodStreak([...f, { day: '2026-11-07', items: 2 }], '2026-11-07'), 7)
  f[2].items = 1
  assert.equal(foodStreak(f, '2026-11-07'), 3)
})

test('trainingWeekStreak: bu hafta tamamlanmadıysa geçen haftadan', () => {
  const wo = ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29', '2026-11-03']
  assert.equal(trainingWeekStreak(wo, '2026-11-04'), 3)
  assert.equal(trainingWeekStreak([...wo, '2026-11-05'], '2026-11-05'), 4)
})

test('computeAchievements: kazanılma günleri', () => {
  const a = computeAchievements({
    foodDays: days('2026-10-01', 8).map((d) => ({ day: d, items: 3 })),
    workoutDays: days('2026-10-01', 12), prDays: ['2026-10-03'], goalReachedDay: null, checkinDays: ['2026-10-08'], today: '2026-11-01',
  })
  const by = Object.fromEntries(a.map((x) => [x.id, x.earnedDay]))
  assert.equal(by['food-first'], '2026-10-01')
  assert.equal(by['food-streak-7'], '2026-10-07')
  assert.equal(by['food-streak-30'], null)
  assert.equal(by['wo-10'], '2026-10-10')
  assert.equal(by['pr-first'], '2026-10-03')
  assert.equal(by['checkin-4'], null)
})
