import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyError, pickProviders, type ProviderState } from '../lib/ai/policy.ts'
import { jsonSchemaFor, labelPer100, parseResult, strictSubset } from '../lib/ai/schemas.ts'

const P = (id: 'claude' | 'openai', o: Partial<ProviderState> = {}): ProviderState => ({ id, enabled: true, priority: id === 'claude' ? 0 : 1, hasKey: true, dailyTokenLimit: 0, monthlyTokenLimit: 0, usedToday: 0, usedMonth: 0, cooldownUntil: null, ...o })
const now = new Date('2026-11-05T10:00:00Z')

test('sağlayıcı seçimi: öncelik, anahtar, bekleme, limit', () => {
  assert.deepEqual(pickProviders([P('openai'), P('claude')], now).usable, ['claude', 'openai'])
  const r = pickProviders([P('claude', { cooldownUntil: new Date(now.getTime() + 60000) }), P('openai', { hasKey: false })], now)
  assert.deepEqual(r.usable, []); assert.deepEqual(r.skipped.map((s) => s.reason), ['bekleme süresinde', 'anahtar yok'])
  assert.deepEqual(pickProviders([P('claude', { dailyTokenLimit: 1000, usedToday: 1000 }), P('openai')], now).usable, ['openai'])
  assert.deepEqual(pickProviders([P('claude', { monthlyTokenLimit: 5000, usedMonth: 4999 })], now).usable, ['claude'])
  assert.deepEqual(pickProviders([P('claude', { cooldownUntil: new Date(now.getTime() - 1) })], now).usable, ['claude']) // bekleme bitti
  assert.deepEqual(pickProviders([P('claude', { enabled: false }), P('openai', { priority: 0 })], now).usable, ['openai'])
})

test('hata sınıflandırması (OpenAI belgesindeki kodlar, Claude durumları)', () => {
  assert.equal(classifyError(429, 'credit_balance_exhausted').kind, 'quota')
  assert.equal(classifyError(429, 'organization_spend_limit_exceeded').kind, 'quota')
  assert.equal(classifyError(429, 'project_spend_limit_exceeded').kind, 'quota')
  assert.equal(classifyError(429, 'organization_usage_limit_exceeded').kind, 'quota')
  assert.equal(classifyError(429, 'slow_down').kind, 'rate')
  assert.equal(classifyError(429, 'rate_limit_error').kind, 'rate')
  assert.equal(classifyError(503, 'server_is_overloaded').kind, 'overloaded')
  assert.equal(classifyError(529, 'overloaded_error').kind, 'overloaded')
  assert.equal(classifyError(401, 'authentication_error').kind, 'auth')
  assert.equal(classifyError(null, null).kind, 'network')
  assert.ok(classifyError(429, 'credit_balance_exhausted').cooldownMs > classifyError(429, 'slow_down').cooldownMs)
  for (const [s, c] of [[429, 'x'], [500, null], [401, null], [400, null]] as const) assert.equal(classifyError(s, c).failover, true)
})

test('JSON Schema alt kümesi: ek alan kapalı, tüm alanlar zorunlu, kısıtlar açıklamada, enum korunur', () => {
  const walk = (n: Record<string, unknown>, f: (n: Record<string, unknown>) => void) => { f(n); for (const v of Object.values(n)) { if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && walk(x as never, f)); else if (v && typeof v === 'object') walk(v as never, f) } }
  for (const t of ['meal-photo', 'meal-text', 'label'] as const) {
    walk(jsonSchemaFor(t), (n) => {
      if (n.type === 'object' && n.properties) { assert.equal(n.additionalProperties, false); assert.deepEqual([...(n.required as string[])].sort(), Object.keys(n.properties as object).sort()) }
      for (const k of ['minimum', 'maximum', 'maxLength', 'minLength', 'maxItems']) assert.equal(n[k], undefined, `${t}: ${k} kalmış`)
    })
  }
  const s = strictSubset({ type: 'string', enum: ['a', 'b'], maxLength: 3, description: 'x' })
  assert.deepEqual(s, { type: 'string', enum: ['a', 'b'], description: 'x (maxLength: 3)' })
})

test('yanıt doğrulama: geçerli, metin içinde JSON, şema dışı reddedilir', () => {
  const ok = parseResult('meal-text', 'İşte: {"items":[{"name":"simit","grams":100,"portion":"1 adet","drink":null,"confidence":"yüksek"}],"note":null}')
  assert.equal(ok.items[0].grams, 100)
  assert.throws(() => parseResult('meal-text', '{"items":[{"name":"simit","grams":-5,"portion":null,"drink":null,"confidence":"yüksek"}],"note":null}'))
  assert.throws(() => parseResult('meal-text', '{"items":[{"name":"x","grams":10,"portion":null,"drink":"bira","confidence":"yüksek"}],"note":null}')) // su modülünde olmayan içecek
  assert.throws(() => parseResult('label', 'tablo yok'))
})

test('etiket: porsiyon bazlı değerler 100 g\'a çevrilir; okunamadıysa null', () => {
  const base = { name: 'Kraker', brand: null, servingGrams: 40, kcal: 160, protein: 4, carb: 24, sugar: 2, fat: 5, satFat: 1, fiber: 1.2, salt: 0.2 }
  assert.deepEqual(labelPer100({ ...base, basis: 'porsiyon' }), { kcal: 400, protein: 10, carb: 60, fat: 12.5, sugar: 5, fiber: 3, salt: 0.5, satFat: 2.5 })
  assert.equal(labelPer100({ ...base, basis: '100g' })!.kcal, 160)
  assert.equal(labelPer100({ ...base, basis: 'porsiyon', servingGrams: null }), null)
  assert.equal(labelPer100({ ...base, basis: 'okunamadı' }), null)
})

test('sınır dışı sayı yanıtı atmaz, sınıra çekilir; negatif ve eksik alan reddedilir', () => {
  const recipe = (grams: number, minutes: number) => JSON.stringify({ recipes: [{ title: 'Patatesli pilav', minutes, servings: 2, ingredients: [{ name: 'Pirinç', grams: 150 }, { name: 'Tuz', grams }], steps: ['Pişir'] }], note: null })
  // canlıdaki gerçek hata: tuz 2 g → eskiden tüm yanıt reddediliyordu
  const a = parseResult('pantry', recipe(2, 30)) as { recipes: { minutes: number; ingredients: { grams: number }[] }[] }
  assert.equal(a.recipes[0].ingredients[1].grams, 2)
  const b = parseResult('pantry', recipe(0.1, 400)) as { recipes: { minutes: number; ingredients: { grams: number }[] }[] }
  assert.equal(b.recipes[0].ingredients[1].grams, 0.5)
  assert.equal(b.recipes[0].minutes, 180)
  assert.throws(() => parseResult('pantry', recipe(-3, 30)))
  assert.throws(() => parseResult('pantry', JSON.stringify({ recipes: [{ title: 'x' }], note: null })))
})
