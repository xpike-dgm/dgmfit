import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeRules, wizardDesign, type WizardAnswers } from '../lib/cards/wizard.ts'
import { applyGestures, setHiddenToday, setPin, type Gestures } from '../lib/cards/prefs.ts'
import { defaultItems, normalizeScreen, migrateDesign } from '../lib/cards/layout.ts'
import { quickOf, cardDef } from '../lib/cards/registry.ts'

const ids = (xs: { id: string }[]) => xs.map((i) => i.id)
const A = (o: Partial<WizardAnswers> = {}): WizardAnswers => ({ focus: 'weight', logs: ['food'], detail: 'simple', hand: 'both', time: 'all', ...o })

test('sihirbaz: odak ve kayıtlar öne; sade modda az kullanılanlar çıkar, ayrıntılıda Seriler eklenir', () => {
  const w = wizardDesign(A())
  assert.deepEqual(ids(w.today).slice(0, 3), ['today.header', 'today.macros', 'today.fit'])
  assert.equal(ids(w.today)[3], 'today.water', 'Su, Fit\'in yanında kalır')
  for (const id of ['today.week-brief', 'today.partner', 'today.streaks']) assert.ok(!ids(w.today).includes(id), id)
  const s = wizardDesign(A({ focus: 'strength', logs: ['training', 'water'], detail: 'detailed' }))
  assert.deepEqual(ids(s.today).slice(0, 3), ['today.header', 'today.training', 'today.macros'])
  assert.ok(ids(s.today).includes('today.streaks'))
  assert.deepEqual(s.nav.order.slice(0, 3), ['today', 'fitness', 'water'])
  // öne alınan Su yerinde kalır, Fit yanına gelir (özet doğru kalsın)
  assert.deepEqual(ids(s.today).slice(0, 5), ['today.header', 'today.training', 'today.macros', 'today.water', 'today.fit'])
})

test('sihirbaz: kilitli kartlar korunur, sonuç normalize edilince değişmez', () => {
  for (const focus of ['weight', 'strength', 'health'] as const) for (const detail of ['simple', 'detailed'] as const) {
    const w = wizardDesign(A({ focus, detail, logs: ['water', 'training', 'food'] }))
    assert.ok(ids(w.today).includes('today.goal-choice'), 'hedef seçimi kartı kalır')
    assert.equal(w.today[0].id, 'today.header')
    assert.deepEqual(ids(normalizeScreen('today', w.today).items), ids(w.today))
  }
})

test('sihirbaz: el, zaman ve antrenman kuralları; kurallar birleştirilirken tekrar yok', () => {
  const w = wizardDesign(A({ hand: 'left', time: 'morning', logs: ['training'] }))
  assert.equal(w.hand, 'left')
  assert.deepEqual(w.rules.map((r) => r.id), ['preset-morning', 'preset-training'])
  assert.equal(wizardDesign(A({ hand: 'both' })).hand, null)
  const merged = mergeRules([{ ...w.rules[0], on: false }], w.rules)
  assert.equal(merged.length, 2)
  assert.ok(merged.every((r) => r.on))
  assert.equal(w.summary.length, 4)
})

test('kaydırma: bugünlük gizle yalnız bugün geçerli; sabit kart başlığın altında; kilitli kart gizlenemez', () => {
  const base = defaultItems('today')
  let g: Gestures = {}
  g = setHiddenToday(g, 'today.water', true, '2026-11-07')
  g = setHiddenToday(g, 'today.goal-choice', true, '2026-11-07')
  g = setPin(g, 'today.coach', true)
  g = setPin(g, 'today.header', true)
  const r = applyGestures('today', base, g, '2026-11-07')
  assert.ok(!ids(r.items).includes('today.water'))
  assert.ok(ids(r.items).includes('today.goal-choice'))
  assert.deepEqual(ids(r.items).slice(0, 2), ['today.header', 'today.coach'])
  assert.deepEqual(r.pinned, ['today.coach'])
  const tomorrow = applyGestures('today', base, g, '2026-11-08')
  assert.ok(ids(tomorrow.items).includes('today.water'), 'ertesi gün geri gelir')
  assert.deepEqual(applyGestures('fit', defaultItems('fit'), g, '2026-11-07').pinned, [], 'başka ekranı etkilemez')
  assert.deepEqual(setPin(g, 'today.coach', false).pins!.today, [])
  // eski günün listesi yeni gizlemede sıfırlanır
  assert.deepEqual(setHiddenToday(g, 'today.fit', true, '2026-11-08').daily, { day: '2026-11-08', hidden: ['today.fit'] })
})

test('hızlı eylem: geçersiz seçim varsayılana düşer; seçeneksiz kart null', () => {
  assert.equal(quickOf('today.water', '500'), '500')
  assert.equal(quickOf('today.water', 'yok'), '250')
  assert.equal(quickOf('today.water'), '250')
  assert.equal(quickOf('today.coach', 'x'), null)
  assert.ok(cardDef('today.fit')!.quick!.some((q) => q.id === 'weigh'))
})

test('göç sabitleri ve bugünlük gizlenenleri de eşler', async () => {
  const reg = await import('../lib/cards/registry.ts')
  const saved = [...reg.CARD_MIGRATIONS]
  reg.CARD_MIGRATIONS.push({ version: reg.REGISTRY_VERSION + 1, map: { 'today.water': ['today.fit'], 'today.coach': [] } })
  try {
    const m = migrateDesign({ v: reg.REGISTRY_VERSION, screens: {}, gestures: { pins: { today: ['today.coach', 'today.water'] }, daily: { day: 'x', hidden: ['today.water'] } } })
    assert.deepEqual(m.design.gestures!.pins!.today, ['today.fit'])
    assert.deepEqual(m.design.gestures!.daily!.hidden, ['today.fit'])
  } finally { reg.CARD_MIGRATIONS.splice(0, reg.CARD_MIGRATIONS.length, ...saved) }
})
