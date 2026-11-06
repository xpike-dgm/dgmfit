import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adjustAfter, prPlan, prResult, type Felt } from '../lib/pr-attempt.ts'

test('plan: bar + ısınmalar + 3 deneme, yuvarlama, dinlenme, soru', () => {
  const p = prPlan(100, 20, 2.5)
  assert.deepEqual(p.map((s) => [s.kind[0], s.kg, s.reps]), [['w', 20, 8], ['w', 40, 5], ['w', 55, 3], ['w', 70, 2], ['w', 80, 1], ['w', 90, 1], ['a', 95, 1], ['a', 100, 1], ['a', 102.5, 1]])
  assert.deepEqual(p.map((s) => s.rest), [60, 60, 60, 90, 120, 180, 240, 240, 240])
  assert.deepEqual(p.filter((s) => s.ask).map((s) => s.kg), [80, 90, 95, 100, 102.5])
  assert.deepEqual(p.filter((s) => s.kind === 'attempt').map((s) => s.n), [1, 2, 3])
  // hafif hedef: bar tekrarlanmaz, bar altına inilmez
  const q = prPlan(40, 20, 2.5)
  assert.ok(q.every((s) => s.kg >= 20)); assert.equal(new Set(q.filter((s) => s.kind === 'warmup').map((s) => s.kg)).size, q.filter((s) => s.kind === 'warmup').length)
})

test('ayar: son ısınma → açılış; açılış → 2. deneme; 2. → 3.', () => {
  const p = prPlan(100)
  const lastW = p.findIndex((s) => s.kind === 'attempt') - 1
  assert.equal(adjustAfter(p, lastW, 'hard', [], 100)[lastW + 1].kg, 92.5)
  assert.equal(adjustAfter(p, lastW, 'easy', [], 100)[lastW + 1].kg, 97.5)
  const a1 = lastW + 1
  // açılış 95: zor → en çok hedef (95+2,5=97,5), normal → hedef, hafif → ≥ hedef
  assert.equal(adjustAfter(p, a1, 'hard', [{ kg: 95, ok: true }], 100)[a1 + 1].kg, 97.5)
  assert.equal(adjustAfter(p, a1, 'normal', [{ kg: 95, ok: true }], 100)[a1 + 1].kg, 100)
  assert.equal(adjustAfter(p, a1, 'easy', [{ kg: 95, ok: true }], 100)[a1 + 1].kg, 100)
  assert.equal(adjustAfter(p, a1, 'fail', [{ kg: 95, ok: false }], 100)[a1 + 1].kg, 92.5)
  // 2. deneme 100: zor → 102,5; normal → 102,5; hafif → 105; başarısız (önceki 95 başarılı) → 97,5
  const a2 = a1 + 1
  assert.equal(adjustAfter(p, a2, 'hard', [{ kg: 95, ok: true }, { kg: 100, ok: true }], 100)[a2 + 1].kg, 102.5)
  assert.equal(adjustAfter(p, a2, 'easy', [{ kg: 95, ok: true }, { kg: 100, ok: true }], 100)[a2 + 1].kg, 105)
  assert.equal(adjustAfter(p, a2, 'fail', [{ kg: 95, ok: true }, { kg: 100, ok: false }], 100)[a2 + 1].kg, 97.5)
  // ısınma ortasında veya son denemede değişiklik yok
  assert.deepEqual(adjustAfter(p, 1, 'hard', [], 100), p)
  assert.deepEqual(adjustAfter(p, p.length - 1, 'easy', [], 100), p)
})

test('sonuç: en iyi başarılı deneme, set listesi, RiR', () => {
  const p = prPlan(100)
  const log: { kg: number; felt: Felt | null }[] = p.map((s) => ({ kg: s.kg, felt: s.kind === 'attempt' ? 'normal' : null }))
  log[log.length - 1] = { kg: 102.5, felt: 'fail' }
  const r = prResult(p, log, 100)
  assert.equal(r.best, 100); assert.equal(r.reached, true); assert.match(r.text, /Hedefine ulaştın\./)
  assert.equal(r.sets.length, p.length); assert.equal(r.sets[0].type, 'warmup'); assert.equal(r.sets.at(-1)!.reps, 0); assert.equal(r.sets.at(-2)!.rir, 1)
  const skipped = p.map((s, i) => (i === 1 ? null : { kg: s.kg, felt: s.kind === 'attempt' ? 'fail' as const : null }))
  const r2 = prResult(p, skipped, 100)
  assert.equal(r2.best, null); assert.equal(r2.reached, false); assert.equal(r2.sets.length, p.length - 1); assert.match(r2.text, /Başarılı deneme yok/)
  const r3 = prResult(p, p.map((s) => ({ kg: s.kind === 'attempt' ? 105 : s.kg, felt: 'easy' as const })), 100)
  assert.match(r3.text, /üstüne 5 kg/)
})
