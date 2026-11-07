import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESET_RULES, applyRules, condMatches, describeRule, goalFront, normalizeNav, normalizeRules, resolveNav, type Rule, type RuleCtx } from '../lib/cards/prefs.ts'
import { defaultItems, migrateDesign, type LayoutItem } from '../lib/cards/layout.ts'
import { cardDef } from '../lib/cards/registry.ts'

const ids = (xs: { id: string }[]) => xs.map((i) => i.id)
const make = (id: string): LayoutItem | null => (cardDef(id) ? { id } : null)
const ctx = (o: Partial<RuleCtx> = {}): RuleCtx => ({ minute: 12 * 60, weekday: 3, training: false, goal: 'lose', ...o })

test('alt bar: varsayılan sıra; Bugün gizlenemez; en az 3 sekme; bilinmeyen/tekrar atılır', () => {
  assert.deepEqual(resolveNav(null).visible, ['today', 'plan', 'water', 'food', 'fitness', 'social'])
  const r = resolveNav({ order: ['social', 'today', 'social', 'yok' as never, 'food'], hidden: ['today', 'plan'] })
  assert.deepEqual(r.visible, ['social', 'today', 'food', 'water', 'fitness'])
  assert.deepEqual(r.hidden, ['plan'])
  const few = resolveNav({ hidden: ['plan', 'water', 'food', 'fitness', 'social'] })
  assert.equal(few.visible.length, 3)
  assert.ok(few.visible.includes('today'))
  assert.deepEqual(normalizeNav({ hidden: ['water'] }).order!.slice(-1), ['water'])
})

test('koşullar: saat aralığı (gece yarısını aşan dahil), gün, antrenman/dinlenme, hedef', () => {
  assert.ok(condMatches({ kind: 'time', from: 300, to: 660 }, ctx({ minute: 300 })))
  assert.ok(!condMatches({ kind: 'time', from: 300, to: 660 }, ctx({ minute: 660 })))
  assert.ok(condMatches({ kind: 'time', from: 22 * 60, to: 120 }, ctx({ minute: 30 })))
  assert.ok(!condMatches({ kind: 'time', from: 22 * 60, to: 120 }, ctx({ minute: 600 })))
  assert.ok(condMatches({ kind: 'weekday', days: [1, 3] }, ctx()))
  assert.ok(condMatches({ kind: 'training' }, ctx({ training: true })) && condMatches({ kind: 'rest' }, ctx()))
  assert.ok(condMatches({ kind: 'goal', goal: 'lose' }, ctx()) && !condMatches({ kind: 'goal', goal: 'gain' }, ctx()))
})

test('kurallar: üste al başlığın altına, gizle, göster (çekmecedeki kart); kapalı ve eşleşmeyen kural etkisiz', () => {
  const base = defaultItems('today')
  const rules: Rule[] = [
    { id: 'a', name: 'Antrenman', on: true, when: [{ kind: 'training' }], then: [{ kind: 'top', card: 'today.training' }, { kind: 'hide', card: 'today.water' }, { kind: 'show', card: 'today.streaks' }] },
    { id: 'b', name: 'Kapalı', on: false, when: [{ kind: 'training' }], then: [{ kind: 'hide', card: 'today.macros' }] },
    { id: 'c', name: 'Pazar', on: true, when: [{ kind: 'weekday', days: [0] }], then: [{ kind: 'hide', card: 'today.fit' }] },
  ]
  const r = applyRules('today', base, rules, ctx({ training: true }), make)
  assert.deepEqual(r.applied, ['Antrenman'])
  assert.equal(r.items[0].id, 'today.header')
  assert.equal(r.items[1].id, 'today.training')
  assert.ok(!ids(r.items).includes('today.water'))
  assert.ok(ids(r.items).includes('today.streaks') && ids(r.items).includes('today.macros') && ids(r.items).includes('today.fit'))
  const none = applyRules('today', base, rules, ctx(), make)
  assert.equal(none.items, base, 'eşleşme yoksa aynı dizi')
})

test('kurallar: sonraki kural öncekini ezer; kilitli kart gizlenemez; başka ekranın kartı yok sayılır', () => {
  const base = defaultItems('today')
  const rules: Rule[] = [
    { id: 'a', name: 'A', on: true, when: [{ kind: 'rest' }], then: [{ kind: 'hide', card: 'today.water' }, { kind: 'hide', card: 'today.goal-choice' }, { kind: 'hide', card: 'today.header' }, { kind: 'top', card: 'water.logs' }] },
    { id: 'b', name: 'B', on: true, when: [{ kind: 'rest' }], then: [{ kind: 'top', card: 'today.water' }] },
  ]
  const r = applyRules('today', base, rules, ctx(), make)
  assert.equal(r.items[1].id, 'today.water')
  assert.ok(ids(r.items).includes('today.goal-choice') && ids(r.items).includes('today.header'))
  assert.ok(!ids(r.items).includes('water.logs'))
})

test('kural doğrulama: bilinmeyen kart, boş koşul, hatalı saat, kilitli kartı gizleme atılır; en fazla 20', () => {
  const bad: Rule[] = [
    { id: 'x', name: '  ', on: true, when: [{ kind: 'time', from: 0, to: 2000 }], then: [{ kind: 'top', card: 'today.water' }] },
    { id: 'y', name: 'Y', on: true, when: [{ kind: 'weekday', days: [9, 1, 1] }], then: [{ kind: 'hide', card: 'today.goal-choice' }, { kind: 'top', card: 'yok.kart' }, { kind: 'show', card: 'today.streaks' }] },
  ]
  const n = normalizeRules(bad)
  assert.equal(n.length, 1)
  assert.deepEqual(n[0].when, [{ kind: 'weekday', days: [1] }])
  assert.deepEqual(n[0].then, [{ kind: 'show', card: 'today.streaks' }])
  assert.equal(normalizeRules(Array.from({ length: 30 }, (_, i) => ({ ...PRESET_RULES[0], id: 'r' + i }))).length, 20)
})

test('hazır kurallar geçerli ve okunur özetleri var', () => {
  assert.equal(normalizeRules(PRESET_RULES).length, PRESET_RULES.length)
  assert.match(describeRule(PRESET_RULES[0]), /^Saat 05\.00–11\.00 → Bugün · Su üstte$/)
  assert.match(describeRule(PRESET_RULES[1]), /Antrenman günü → Bugün · Antrenman üstte; Fitness/)
})

test('hedefe göre varsayılan: ilgili kart başlığın altına; hedef yoksa değişmez', () => {
  const base = defaultItems('today')
  assert.deepEqual(ids(goalFront('today', base, 'gain')).slice(0, 3), ['today.header', 'today.training', 'today.macros'])
  assert.equal(goalFront('today', base, null), base)
  assert.equal(goalFront('water', defaultItems('water'), 'lose').length, defaultItems('water').length)
})

test('göç kurallardaki kart kimliklerini de eşler (kural, alt bar ve tercihler korunur)', async () => {
  const reg = await import('../lib/cards/registry.ts')
  const saved = [...reg.CARD_MIGRATIONS]
  reg.CARD_MIGRATIONS.push({ version: reg.REGISTRY_VERSION + 1, map: { 'today.water': ['today.fit'], 'today.coach': [] } })
  try {
    const m = migrateDesign({ v: reg.REGISTRY_VERSION, screens: {}, nav: { hidden: ['social'] }, prefs: { hand: 'left' },
      rules: [{ id: 'a', name: 'A', on: true, when: [{ kind: 'training' }], then: [{ kind: 'top', card: 'today.water' }] },
        { id: 'b', name: 'B', on: true, when: [{ kind: 'training' }], then: [{ kind: 'hide', card: 'today.coach' }] }] })
    assert.deepEqual(m.design.rules!.map((r) => r.then.map((a) => a.card)), [['today.fit']])
    assert.deepEqual(m.design.nav, { hidden: ['social'] })
    assert.equal(m.design.prefs!.hand, 'left')
  } finally { reg.CARD_MIGRATIONS.splice(0, reg.CARD_MIGRATIONS.length, ...saved) }
})
