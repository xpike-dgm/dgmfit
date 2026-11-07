import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysUntil, dayValue, goalProgress, isUserCard, newUserCardId, normalizeTracker, normalizeUserCard, summarize, userCardScreen } from '../lib/cards/custom.ts'

test('kullanıcı kartı kimliği ve doğrulama', () => {
  const id = newUserCardId('today', 'Ab12-cd34')
  assert.ok(isUserCard(id)); assert.equal(userCardScreen(id), 'today')
  assert.ok(!isUserCard('u.today.x')); assert.ok(!isUserCard('u.sosyal.abcdef12'))
  assert.deepEqual(normalizeUserCard({ kind: 'metric', screen: 'today', title: '  Su  haftası ', metric: 'water', period: '7d', view: 'spark', goal: 2000 }), { kind: 'metric', screen: 'today', title: 'Su haftası', metric: 'water', period: '7d', view: 'spark', goal: 2000 })
  assert.equal(normalizeUserCard({ kind: 'metric', screen: 'today', title: 'X', metric: 'nabız' }), null)
  assert.equal(normalizeUserCard({ kind: 'quote', screen: 'today', title: 'Söz', text: '   ' }), null)
  assert.equal(normalizeUserCard({ kind: 'countdown', screen: 'yok', title: 'Düğün', date: '2027-01-01' }), null)
  assert.equal(normalizeUserCard({ kind: 'photo', screen: 'fit', title: 'Hedef', mediaId: '../x' }), null)
  assert.equal(normalizeUserCard({ kind: 'quote', screen: 'mine', title: 'Söz', text: 'x'.repeat(300) })!.kind, 'quote')
})

test('takip alanı: tür, adım, hedef, birim temizliği', () => {
  assert.deepEqual(normalizeTracker({ name: 'Kahve', unit: 'fincan', kind: 'count', goal: 3, goalDir: 'max', step: 1, emoji: '☕️x' }), { name: 'Kahve', unit: 'fincan', kind: 'count', goal: 3, goalDir: 'max', step: 1, emoji: '☕️' })
  assert.equal(normalizeTracker({ name: 'R', kind: 'scale' }), null)
  assert.equal(normalizeTracker({ name: 'Ruh hali', kind: 'scale', step: 5 })!.step, 1)
  assert.equal(normalizeTracker({ name: 'Ruh hali', kind: 'scale', unit: 'x' })!.unit, '/5')
})

test('gün değeri ve dönem özeti türüne göre', () => {
  assert.equal(dayValue('count', [1, 2, 1]), 4); assert.equal(dayValue('number', [7, 6.5]), 6.5); assert.equal(dayValue('scale', [3, 4]), 3.5)
  assert.equal(dayValue('yesno', [0, 1]), 1); assert.equal(dayValue('count', []), null)
  const days = ['2026-11-05', '2026-11-06', '2026-11-07']
  const logs = [{ day: '2026-11-05', value: 2 }, { day: '2026-11-07', value: 1 }, { day: '2026-11-07', value: 3 }]
  assert.deepEqual(summarize('count', logs, days), { series: [2, null, 4], value: 2, loggedDays: 2 })
  assert.equal(summarize('scale', logs, days).value, 2, 'günlük ortalamaların ortalaması: (2 + (1+3)/2) / 2')
  assert.equal(summarize('count', logs, ['2026-11-07']).value, 4)
  assert.equal(goalProgress(2, 4), 0.5); assert.equal(goalProgress(null, 4), null)
  assert.equal(daysUntil('2026-11-17', '2026-11-07'), 10); assert.equal(daysUntil('2026-11-01', '2026-11-07'), -6)
})

test('kendi kartı düzende: ad, çekmece, silinen kart düşer, şablona girmez, tasarımlar arasında taşınır', async () => {
  const { resolveScreen, emptyDesign } = await import('../lib/cards/layout.ts')
  const { shareable, personalPart, withPersonal, applyTemplate } = await import('../lib/cards/share.ts')
  const a = 'u.today.abc123', b = 'u.today.def456', gone = 'u.today.zzz999', w = 'u.water.qqq111'
  const d = { ...emptyDesign(), screens: { today: { items: [{ id: 'today.header' }, { id: a }, { id: gone }, { id: 'today.water', stack: [b] }] } },
    userCards: { [a]: { kind: 'quote', screen: 'today', title: 'Sözüm', text: 'x' }, [b]: { kind: 'records', screen: 'today', title: 'Rekor' }, [w]: { kind: 'records', screen: 'water', title: 'Su kartım' } } } as never
  const r = resolveScreen(d, 'today')
  assert.ok(r.items.some((i) => i.id === a && i.def.title === 'Sözüm'))
  assert.ok(!r.items.some((i) => i.id === gone), 'tanımı olmayan kart düşer')
  assert.ok(!r.notices.some((n) => n.includes(gone)), 'silinen kendi kartı için uyarı yok')
  assert.deepEqual(r.items.find((i) => i.id === 'today.water')?.stack, [b])
  assert.ok(!r.drawer.some((x) => x.def.id === a))
  const rw = resolveScreen(d, 'water')
  assert.ok(rw.drawer.some((x) => x.def.id === w && x.def.title === 'Su kartım'), 'yerleşmemiş kendi kartı kendi ekranının çekmecesinde')
  const s = shareable(d)
  assert.equal(JSON.stringify(s).includes('u.today.'), false, 'şablonda kendi kartı yok')
  assert.equal('userCards' in s, false)
  assert.deepEqual(personalPart(d).userCards, (d as { userCards: unknown }).userCards)
  const moved = withPersonal(emptyDesign(), personalPart(d))
  assert.ok(moved.userCards?.[a])
  const applied = applyTemplate(d, s, 'all')
  assert.ok(applied.userCards?.[a], 'şablon uygulanınca kendi kartlarım kalır')
  const { normalizeScreen } = await import('../lib/cards/layout.ts')
  const n = normalizeScreen('today', [{ id: 'today.header' }, { id: a }, { id: gone }], {}, (d as { userCards: never }).userCards)
  assert.ok(n.items.some((i) => i.id === a) && !n.items.some((i) => i.id === gone), 'kaydederken tanımlı kendi kartı kalır, tanımsız düşer')
  assert.ok(!normalizeScreen('today', [{ id: a }]).items.some((i) => i.id === a), 'tanımlar verilmezse kendi kartı kabul edilmez')
})
