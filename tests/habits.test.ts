import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usualMeal } from '../lib/habits.ts'

const egg = (g = 100) => ({ foodId: 1, name: 'Yumurta', grams: g, kcal: Math.round(g * 1.55) })
const cheese = (g = 30) => ({ foodId: 2, name: 'Beyaz peynir', grams: g, kcal: Math.round(g * 2.6) })
const bread = (g = 50) => ({ foodId: 3, name: 'Ekmek', grams: g, kcal: Math.round(g * 2.7) })
const jam = { foodId: 4, name: 'Reçel', grams: 20, kcal: 50 }

test('usualMeal: sık yenenler, gram medyanı', () => {
  const r = usualMeal([[egg(100), cheese(), bread()], [egg(120), cheese(), bread()], [egg(100), cheese(40), jam], [egg(110), bread()], [], [jam]])!
  assert.deepEqual(r.items.map((x) => x.name), ['Yumurta', 'Beyaz peynir', 'Ekmek'])
  assert.equal(r.items[0].grams, 105)
  assert.equal(r.kcal, r.items.reduce((a, x) => a + x.kcal, 0))
})

test('usualMeal: 3 günden az kayıt ya da ortak besin yoksa null', () => {
  assert.equal(usualMeal([[egg()], [egg()]]), null)
  assert.equal(usualMeal([[egg()], [cheese()], [bread()], [jam]]), null)
})

test('usualMeal: aynı gün aynı besin iki kez → gramlar toplanır', () => {
  const r = usualMeal([[egg(50), egg(50)], [egg(100)], [egg(100)]])!
  assert.equal(r.items[0].grams, 100)
})

import { decideMealReminder, habitMinute } from '../lib/habits.ts'

test('habitMinute: en az 5 gün, medyan', () => {
  assert.equal(habitMinute([480, 490, 500, 470]), null)
  assert.equal(habitMinute([480, 490, 500, 470, 900]), 490)
})

test('decideMealReminder: alışkanlık + 60 dk ile +180 dk arası, kayıt/gönderim yoksa', () => {
  const habit = { breakfast: 480, lunch: 780, dinner: null }
  assert.equal(decideMealReminder({ now: 530, habit, logged: new Set(), sent: new Set() }), null)
  assert.equal(decideMealReminder({ now: 545, habit, logged: new Set(), sent: new Set() }), 'breakfast')
  assert.equal(decideMealReminder({ now: 545, habit, logged: new Set(['breakfast']), sent: new Set() }), null)
  assert.equal(decideMealReminder({ now: 545, habit, logged: new Set(), sent: new Set(['breakfast']) }), null)
  assert.equal(decideMealReminder({ now: 700, habit, logged: new Set(), sent: new Set() }), null, '3 saatten geç')
  assert.equal(decideMealReminder({ now: 845, habit, logged: new Set(['breakfast']), sent: new Set() }), 'lunch')
})
