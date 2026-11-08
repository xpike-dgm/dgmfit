import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numbersAllowed, ruleSuggestions, trendSeries, weekStats, type DayFacts } from '../lib/weekly.ts'
import { riskyText, safetyFlags } from '../lib/safety.ts'
import { insightCandidates, pickInsight } from '../lib/insights.ts'

// 2026-11-02 Pazartesi … 2026-11-08 Pazar
const day = (i: number, start = '2026-11-02') => new Date(Date.parse(start + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10)
const mk = (i: number, o: Partial<DayFacts> = {}, start?: string): DayFacts => ({ day: day(i, start), target: 2000, eaten: 2000, items: 6, protein: 120, proteinTarget: 120, burned: 0, waterMl: 2500, waterGoal: 2500, workouts: 0, cardioMin: 0, volumeKg: 0, ...o })

test('haftalık: ortalama, uyum, en zor günler, hafta sonu farkı', () => {
  const days = [mk(0), mk(1, { eaten: 2400 }), mk(2), mk(3, { items: 0, eaten: 0 }), mk(4), mk(5, { eaten: 2800 }), mk(6, { eaten: 2600 })]
  const s = weekStats(days, [], 2)
  assert.equal(s.loggedDays, 6)
  assert.equal(s.avgKcal, Math.round((2000 + 2400 + 2000 + 2000 + 2800 + 2600) / 6))
  assert.deepEqual(s.hardest.map((h) => [h.weekday, h.over]), [['Cumartesi', 800], ['Pazar', 600]])
  // hafta sonu ort 2700, hafta içi (Pt, Sa, Ça, Cu) ort 2100 → 600
  assert.equal(s.weekendDiff, 600)
  assert.equal(s.prs, 2)
  assert.ok(s.adherencePct! < 100 && s.adherencePct! > 50)
})

test('haftalık: yarım kayıt ortalamaya girmez; su ve antrenman toplamları', () => {
  const days = [mk(0, { eaten: 300, items: 1 }), mk(1, { waterMl: 1000, workouts: 1, volumeKg: 5000, burned: 250 }), mk(2, { cardioMin: 30, burned: 200 })]
  const s = weekStats(days, [])
  assert.equal(s.loggedDays, 2) // 300 < 2000 × 0,3
  assert.equal(s.waterGoalDays, 2)
  assert.equal(s.workouts, 1)
  assert.equal(s.volumeKg, 5000)
  assert.equal(s.burned, 450)
})

test('haftalık: trend kilo değişimi hafta öncesine göre', () => {
  const w = [{ day: '2026-10-26', kg: 80 }, { day: '2026-10-30', kg: 80 }, { day: '2026-11-04', kg: 79 }, { day: '2026-11-07', kg: 79 }]
  const tr = trendSeries(w)
  assert.equal(tr[1].trend, 80)
  const s = weekStats([mk(0), mk(6)], w)
  // 80 → 79,85 → 79,7225 ≈ 79,72; fark −0,3
  assert.equal(s.weightChange, -0.3)
  assert.equal(weekStats([mk(0)], [{ day: '2026-11-03', kg: 79 }]).weightChange, null) // hafta öncesi tartı yok
})

test('kural önerileri: en fazla 3, ilgili sorunlar', () => {
  const s = weekStats([mk(0, { protein: 60 }), mk(1, { protein: 60 }), mk(2, { protein: 60 }), mk(3, { protein: 60, waterMl: 500 }), mk(4, { waterMl: 500 }), mk(5, { eaten: 2700, waterMl: 500 }), mk(6, { eaten: 2700, waterMl: 500 })], [])
  const r = ruleSuggestions(s, 'lose')
  assert.ok(r.length <= 3)
  assert.match(r.join(' '), /Hafta sonları/)
  assert.match(r.join(' '), /Protein/)
  assert.deepEqual(ruleSuggestions(weekStats([mk(0), mk(1), mk(2), mk(3), mk(4), mk(5, { workouts: 1 })], []), 'lose'), ['Hafta dengeli geçti. Aynı düzeni sürdürmek en iyi plan.'])
})

test('sayı denetimi: uydurma sayı yakalanır', () => {
  assert.equal(numbersAllowed('Hafta sonları 650 kcal fazla, %72 protein', [650, 72]), true)
  assert.equal(numbersAllowed('Trend −0,3 kg', [-0.3]), true)
  assert.equal(numbersAllowed('Ortalama 2.150 kcal', [2150]), true)
  assert.equal(numbersAllowed('Ortalama 2.150 kcal, 900 kcal açık', [2150]), false)
  assert.equal(numbersAllowed('3 gün', []), true)
})

test('güvenlik: tekrarlayan çok düşük kalori bayrağı', () => {
  const low = (i: number) => mk(i, { eaten: 700, items: 3 })
  assert.deepEqual(safetyFlags([low(0), low(1), mk(2), low(3), mk(4), mk(5), mk(6)], 1200).flags, ['low_intake'])
  assert.deepEqual(safetyFlags([low(0), low(1), mk(2), mk(3), mk(4), mk(5), mk(6)], 1200).flags, [])
  // tek kalemlik yarım kayıt sayılmaz
  assert.deepEqual(safetyFlags([0, 1, 2, 3].map((i) => mk(i, { eaten: 200, items: 1 })), 1200).flags, [])
})

test('güvenlik: dinlenmesiz hafta ve yüksek harcama + düşük yeme', () => {
  const t = [0, 1, 2, 3, 4, 5, 6].map((i) => mk(i, { workouts: 1 }))
  assert.deepEqual(safetyFlags(t, 1200).flags, ['no_rest'])
  const h = [0, 1, 2, 3, 4, 5].map((i) => mk(i, { burned: 900, eaten: 1100, items: 4 }))
  assert.deepEqual(safetyFlags(h, 1200).flags, ['high_burn_low_intake'])
})

test('güvenlik: riskli ifade', () => {
  assert.equal(riskyText('Yemekten sonra kusuyorum, ne yapmalıyım'), 'ed')
  assert.equal(riskyText('Bir hafta hiç yemeyeceğim'), 'ed')
  assert.equal(riskyText('Artık yaşamak istemiyorum'), 'crisis')
  assert.equal(riskyText('Bu akşam pizza yersem ne olur?'), null)
  assert.equal(riskyText('Kusursuz bir hafta geçirdim'), null)
})

test('içgörü: öncelik, tekrar engeli ve olumlu yedek', () => {
  // 14 gün: hafta sonları +600, protein düşük
  const days = Array.from({ length: 14 }, (_, i) => mk(i, { eaten: [0, 6].includes(new Date(Date.parse(day(i, '2026-10-26') + 'T12:00:00Z')).getUTCDay()) ? 2600 : 2000, protein: 70 }, '2026-10-26'))
  const c = insightCandidates(days, 'lose', null)
  assert.equal(c[0].key, 'weekend_surplus')
  assert.match(c[0].text, /600 kcal/)
  assert.ok(numbersAllowed(c[0].text, c[0].numbers))
  assert.equal(pickInsight(c, ['weekend_surplus']).key, 'protein_low')
  const calm = insightCandidates(Array.from({ length: 7 }, (_, i) => mk(i)), 'lose', null)
  assert.equal(calm[0].key, 'on_track')
  assert.equal(insightCandidates([], 'lose', null)[0].key, 'start')
})

test('içgörü: kayıt boşluğu ve ters trend', () => {
  const d = [mk(0), mk(1), mk(2, { items: 0, eaten: 0 }), mk(3, { items: 0, eaten: 0 })]
  assert.equal(insightCandidates(d, 'lose', null)[0].key, 'logging_gap')
  const t = insightCandidates([mk(0)], 'lose', 0.5)
  assert.equal(t[0].key, 'trend_reverse')
  assert.ok(numbersAllowed(t[0].text, t[0].numbers))
})

import { matchProgramDay, shiftGoal, whatIfImpact } from '../lib/coach-calc.ts'
import { jsonSchemaFor, parseResult } from '../lib/ai/schemas.ts'

test('ne olur: bütçe ve dağıtım Fit motoruyla', () => {
  const upcoming = Array.from({ length: 7 }, (_, i) => ({ day: day(i + 1), base: 2000, current: 0 }))
  const w = whatIfImpact({ items: [{ name: 'pizza', grams: 300, foodName: 'Pizza', kcal: 800 }], target: 2000, eaten: 1500, burned: 0, itemCount: 4, upcoming, floor: 1200 })
  assert.equal(w.remainingBefore, 500)
  assert.equal(w.remainingAfter, -300)
  assert.equal(w.diff, 300)
  assert.equal(w.spread.reduce((a, s) => a + s.kcal, 0), -300)
  const ok = whatIfImpact({ items: [{ name: 'elma', grams: 150, foodName: 'Elma', kcal: 78 }, { name: 'x', grams: 10, foodName: null, kcal: null }], target: 2000, eaten: 1500, burned: 200, itemCount: 4, upcoming, floor: 1200 })
  assert.equal(ok.diff, 0)
  assert.equal(ok.remainingAfter, 622)
  assert.equal(ok.unmatched, 1)
})

test('program günü eşleştirme ve hedef tarihi kaydırma', () => {
  const days = [{ id: 'a', name: 'Gün A — Tam vücut' }, { id: 'b', name: 'Gün B — Tam vücut' }, { id: 'l', name: 'Bacak' }]
  assert.equal(matchProgramDay('bacak', days)?.id, 'l')
  assert.equal(matchProgramDay('Gün B — Tam vücut', days)?.id, 'b')
  assert.equal(matchProgramDay('gün b', days)?.id, 'b')
  assert.equal(matchProgramDay('göğüs', days), null)
  assert.deepEqual(shiftGoal('2027-01-30', '2026-11-05', 2), { newEnd: '2027-02-13', daysLeft: 100 })
  assert.ok('error' in shiftGoal('2026-11-10', '2026-11-05', -1))
  assert.ok('error' in shiftGoal('2027-01-30', '2026-11-05', 0))
})

test('koç şeması: sağlayıcıya giden JSON Schema katı, dönen yanıt doğrulanır', () => {
  const js = jsonSchemaFor('coach') as { properties: Record<string, { items?: { required?: string[]; additionalProperties?: boolean } }>; required: string[] }
  assert.deepEqual(js.required, ['reply', 'actions', 'whatIf', 'safety', 'lookups', 'mealPlan', 'remember', 'memo'])
  assert.equal(js.properties.actions.items?.additionalProperties, false)
  assert.deepEqual(js.properties.actions.items?.required, ['type', 'weeks', 'programDay', 'exercise', 'sets', 'repMin', 'repMax', 'ml', 'drink'])
  const Y2 = { lookups: [], mealPlan: null, remember: [], memo: null }
  const r = parseResult('coach', JSON.stringify({ reply: 'Tamam', actions: [{ type: 'goal_date', weeks: 2, programDay: null, exercise: null, sets: null, repMin: null, repMax: null, ml: null, drink: null }], whatIf: [], safety: 'yok', ...Y2 }))
  assert.equal(r.actions[0].weeks, 2)
  assert.throws(() => parseResult('coach', JSON.stringify({ reply: 'x', actions: [{ type: 'delete_all' }], whatIf: [], safety: 'yok', ...Y2 })))
  // Y2: yeni alanlar eksikse varsayılan
  assert.deepEqual(parseResult('coach', JSON.stringify({ reply: 'x', actions: [], whatIf: [], safety: 'yok' })).lookups, [])
  // Y2: veri isteği ve öğün sınırları doğrulanır
  const r2 = parseResult('coach', JSON.stringify({ reply: 'Bakıyorum', actions: [], whatIf: [], safety: 'yok', ...Y2, lookups: [{ kind: 'gun', date: '2026-11-07', from: null, to: null, query: null }], mealPlan: { protein: 20, carb: 230, fat: 30, kcal: null } }))
  assert.equal(r2.lookups[0].kind, 'gun'); assert.equal(r2.mealPlan?.protein, 20)
  assert.throws(() => parseResult('coach', JSON.stringify({ reply: 'x', actions: [], whatIf: [], safety: 'yok', ...Y2, lookups: [{ kind: 'sil', date: null, from: null, to: null, query: null }] })))
  assert.throws(() => parseResult('weekly', JSON.stringify({ summary: 'x', suggestions: [] })))
})

test('G2: koç gün dökümü — makrolar, su, kalan/fazla', async () => {
  const { dayLine } = await import('../lib/coach-calc.ts')
  const s = dayLine('Dün (2026-11-07 Cumartesi)', { target: 3665, eaten: 2350, items: 1, burned: 0, protein: 100, proteinTarget: 120, carb: 250, carbTarget: 570, fat: 110, fatTarget: 103, waterMl: 0, waterGoal: 2050, workouts: 0, cardioMin: 0 })
  assert.match(s, /^Dün \(2026-11-07 Cumartesi\): /)
  assert.match(s, /kalan 1\.315 kcal/)
  assert.match(s, /protein 100\/120 g \(kalan 20 g\)/)
  assert.match(s, /karbonhidrat 250\/570 g \(kalan 320 g\)/)
  assert.match(s, /yağ 110\/103 g \(7 g fazla\)/)
  assert.match(s, /su 0\/2\.050 ml \(kalan 2\.050 ml\)/)
  assert.doesNotMatch(dayLine('X', { target: 2000, eaten: 2100, items: 3, burned: 0, protein: 0, proteinTarget: 0, waterMl: 0, waterGoal: 0, workouts: 0, cardioMin: 0 }), /öğün kaydı yok/)
  assert.match(dayLine('X', { target: 2000, eaten: 2100, items: 3, burned: 0, protein: 0, proteinTarget: 0, waterMl: 0, waterGoal: 0, workouts: 0, cardioMin: 0 }), /100 kcal fazla/)
})

test('Y2: tüm AI şemaları Claude sınırında (birleşik tipli parametre ≤ 16)', async () => {
  const { TASKS, jsonSchemaFor } = await import('../lib/ai/schemas.ts')
  const unions = (n: unknown): number => {
    if (!n || typeof n !== 'object') return 0
    const o = n as Record<string, unknown>
    let c = (Array.isArray(o.type) || Array.isArray(o.anyOf) || Array.isArray(o.oneOf)) ? 1 : 0
    for (const v of Object.values(o)) c += Array.isArray(v) ? v.reduce((a: number, x) => a + unions(x), 0) : unions(v)
    return c
  }
  for (const task of Object.keys(TASKS)) {
    const n = unions(jsonSchemaFor(task as never))
    assert.ok(n <= 16, `${task}: ${n} birleşik tipli parametre (Claude en çok 16 kabul ediyor)`)
  }
  assert.ok(unions(jsonSchemaFor('coach' as never)) <= 10, 'koç şeması 10 birleşik tip altında kalmalı (pay)')
})
