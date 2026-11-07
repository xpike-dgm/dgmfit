import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { BODY_ONLY, GYM, HOME_DUMBBELL, TEMPLATES, generateProgram } from '../lib/programs.ts'

const src: { id: string; equipment: string | null }[] = JSON.parse(fs.readFileSync(new URL('../data/exercises-src.json', import.meta.url), 'utf8'))
const eq = new Map(src.map((x) => [x.id, x.equipment ?? 'body only']))
const equipmentOf = (k: string) => eq.get(k) ?? 'missing'

test('şablonlardaki tüm hareket anahtarları veri setinde var', () => {
  const missing = TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.slots.flatMap((s) => s.alts))).filter((k) => !eq.has(k))
  assert.deepEqual([...new Set(missing)], [])
})

test('her yuvada vücut ağırlığı ya da yaygın ekipman alternatifi var (ev programı boş kalmasın)', () => {
  for (const t of TEMPLATES) for (const d of t.days) {
    const home = d.slots.filter((s) => s.alts.some((k) => HOME_DUMBBELL.has(equipmentOf(k))))
    assert.ok(home.length >= Math.ceil(d.slots.length / 2), `${t.id}/${d.name}: dumbbell ile ${home.length}/${d.slots.length}`)
  }
})

test('üretici: gün sayısı + deneyim → şablon', () => {
  const g = (days: number, experience: 'new' | 'mid' | 'adv') => generateProgram({ days, experience, available: GYM, minutes: 75, goal: 'gain', equipmentOf })
  assert.equal(g(3, 'new').templateId, 'fullbody'); assert.equal(g(3, 'new').days.length, 3)
  assert.equal(g(3, 'mid').templateId, 'ppl')
  assert.equal(g(4, 'mid').templateId, 'upperlower')
  assert.equal(g(5, 'adv').templateId, 'brosplit')
  assert.equal(g(6, 'mid').days.length, 6)
  assert.equal(g(1, 'new').days.length, 2) // en az 2 gün
  assert.equal(g(3, 'new').days[0].exercises[0].key, 'Barbell_Squat')
  assert.ok(g(3, 'new').days[0].exercises.filter((e) => e.role === 'ana').every((e) => e.sets <= 3), 'yeni başlayanda ana hareket ≤ 3 set')
})

test('üretici: ekipmana uyar, süre hareket sayısını sınırlar', () => {
  const home = generateProgram({ days: 3, experience: 'new', available: HOME_DUMBBELL, minutes: 60, goal: 'lose', equipmentOf })
  for (const d of home.days) for (const e of d.exercises) assert.ok(HOME_DUMBBELL.has(equipmentOf(e.key)) || ['Goblet_Squat', 'Kettlebell_One-Legged_Deadlift'].includes(e.key), `${e.key}: ${equipmentOf(e.key)}`)
  assert.equal(home.days[0].exercises[0].key, 'Goblet_Squat') // dumbbell ile goblet squat
  const bw = generateProgram({ days: 3, experience: 'new', available: BODY_ONLY, minutes: 60, goal: 'gain', equipmentOf }).days[0].exercises.find((e) => e.key === 'Bodyweight_Squat')!
  assert.deepEqual([bw.repMin, bw.repMax], [15, 25])
  assert.ok(home.days.every((d) => d.exercises.length >= 3))
  assert.ok(home.notes.some((n) => /kuvveti korumak/.test(n)))
  const body = generateProgram({ days: 3, experience: 'new', available: BODY_ONLY, minutes: 60, goal: 'gain', equipmentOf })
  assert.ok(body.days.every((d) => d.exercises.length >= 2), 'yalnızca vücut ağırlığıyla da program çıkar')
  const short = generateProgram({ days: 4, experience: 'mid', available: GYM, minutes: 30, goal: 'gain', equipmentOf })
  assert.ok(short.days.every((d) => d.exercises.length <= 3))
  assert.ok(short.notes.some((n) => /çıkarıldı/.test(n)))
})

test('Türkçe etiketler sözlükle aynı', async () => {
  const L = await import('../lib/exercise-labels.ts')
  const tr = JSON.parse(fs.readFileSync(new URL('../data/exercises-tr.json', import.meta.url), 'utf8'))
  assert.deepEqual(L.MUSCLES, tr.muscles); assert.deepEqual(L.EQUIPMENT, tr.equipment); assert.deepEqual(L.LEVEL, tr.level); assert.deepEqual(L.CATEGORY, tr.category)
  assert.deepEqual([...L.MUSCLE_ORDER].sort(), Object.keys(tr.muscles).sort())
})

import { applyPriority, weeklySets } from '../lib/programs.ts'

test('applyPriority: öncelikli yardımcı/izolasyon +1 set, ana hareketlerden hemen sonra; haftalık set notu', () => {
  const g = { templateId: 't', name: 'x', notes: [], days: [{ name: 'A', focus: '', exercises: [
    { key: 'squat', role: 'ana' as const, sets: 3, repMin: 5, repMax: 8, rir: 2, rest: 180 },
    { key: 'curl', role: 'izolasyon' as const, sets: 3, repMin: 10, repMax: 15, rir: 1, rest: 60 },
    { key: 'calf', role: 'izolasyon' as const, sets: 3, repMin: 10, repMax: 15, rir: 1, rest: 60 },
  ] }] }
  const mus = (k: string) => ({ squat: ['quadriceps'], curl: ['biceps'], calf: ['calves'] } as Record<string, string[]>)[k] ?? []
  const r = applyPriority(g, ['calves'], mus, { calves: 'Baldır' })
  assert.deepEqual(r.days[0].exercises.map((e) => [e.key, e.sets]), [['squat', 3], ['calf', 4], ['curl', 3]])
  assert.equal(weeklySets(r.days, mus).get('calves'), 4)
  assert.match(r.notes.join(' '), /Baldır 4/)
  assert.match(r.notes.join(' '), /hacim düşük/)
  assert.equal(applyPriority(g, [], mus), g)
})
