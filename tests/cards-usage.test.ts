import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySuggestion, experiment, suggestLayout, tapRate } from '../lib/cards/usage.ts'
import { defaultItems } from '../lib/cards/layout.ts'

const items = defaultItems('today') // header, macros, goal-choice, week-brief, partner, post-protein, fit, water, training, coach
const ids = (xs: { id: string }[]) => xs.map((i) => i.id)

test('öneri: çok dokunulan aşağıdaki kart üste; hiç dokunulmayan kilitsiz/koşulsuz kart kaldırılsın', () => {
  const usage = [
    { card: 'today.training', views: 30, taps: 12 }, { card: 'today.macros', views: 30, taps: 4 },
    { card: 'today.coach', views: 40, taps: 0 }, { card: 'today.goal-choice', views: 50, taps: 0 }, { card: 'today.week-brief', views: 50, taps: 0 },
  ]
  const s = suggestLayout('today', items, usage)
  assert.deepEqual(s.map((x) => x.id), ['up:today.training', 'remove:today.coach'])
  assert.match(s[0].text, /Antrenman/)
  assert.deepEqual(suggestLayout('today', items, usage, ['up:today.training', 'remove:today.coach']), [], 'reddedilen öneri tekrar gelmez')
  assert.deepEqual(suggestLayout('today', items, [{ card: 'today.training', views: 3, taps: 3 }]), [], 'az veriyle öneri yok')
})

test('öneri uygulanır: üste al başlığın altına, kaldır listeden çıkarır', () => {
  assert.deepEqual(ids(applySuggestion(items, { card: 'today.training', kind: 'up' })).slice(0, 2), ['today.header', 'today.training'])
  assert.ok(!ids(applySuggestion(items, { card: 'today.coach', kind: 'remove' })).includes('today.coach'))
})

test('deney raporu: değişiklik günü hariç önce/sonra ortalaması; az veriyle hazır değil', () => {
  const counts = [
    ...['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((day) => ({ day, count: 2 })),
    { day: '2026-11-05', count: 99 },
    ...['2026-11-06', '2026-11-07', '2026-11-08'].map((day) => ({ day, count: 4 })),
  ]
  const r = experiment('2026-11-05', counts)
  assert.equal(r.ready, true)
  if (r.ready) { assert.equal(r.before, 2); assert.equal(r.after, 4); assert.equal(r.change, 100) }
  assert.equal(experiment('2026-11-05', counts.slice(0, 5)).ready, false)
  assert.equal(tapRate({ card: 'x', views: 10, taps: 3 }), 0.3); assert.equal(tapRate({ card: 'x', views: 0, taps: 0 }), 0)
})
