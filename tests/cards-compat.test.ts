// Ö4: uyumluluk testleri — rastgele (deterministik) tasarımlar ve sahte kayıt değişiklikleri kart düzenini bozmamalı.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARDS, CARD_MIGRATIONS, REGISTRY_VERSION, SCREENS, cardDef, cardsFor, type ScreenId } from '../lib/cards/registry.ts'
import { migrateDesign, normalizeScreen, resolveScreen, type Design, type LayoutItem } from '../lib/cards/layout.ts'
import { applyTemplate, shareable } from '../lib/cards/share.ts'
import { wizardDesign } from '../lib/cards/wizard.ts'

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 } }
const screens = Object.keys(SCREENS) as ScreenId[]
const allIds = CARDS.map((c) => c.id)

function randomItems(r: () => number, screen: ScreenId): LayoutItem[] {
  const pool = [...cardsFor(screen).map((c) => c.id), ...allIds.filter(() => r() < 0.05), 'yok.kart', 'today.eski']
  const n = Math.floor(r() * 14)
  return Array.from({ length: n }, () => {
    const id = pool[Math.floor(r() * pool.length)]
    const it: LayoutItem = { id }
    if (r() < 0.3) it.size = r() < 0.5 ? 'half' : 'full'
    if (r() < 0.2) it.stack = Array.from({ length: 1 + Math.floor(r() * 4) }, () => pool[Math.floor(r() * pool.length)])
    return it
  })
}

function assertValid(screen: ScreenId, r: ReturnType<typeof resolveScreen>, label: string) {
  const all = r.items.flatMap((i) => [i.id, ...(i.stack ?? [])])
  assert.equal(new Set(all).size, all.length, `${label}: tekrar yok`)
  for (const id of all) assert.equal(cardDef(id)?.screen, screen, `${label}: yalnız bu ekranın kartı (${id})`)
  for (const c of cardsFor(screen).filter((c) => c.locked)) assert.ok(all.includes(c.id), `${label}: kilitli kart yerinde (${c.id})`)
  const top = cardsFor(screen).find((c) => c.locked === 'top')
  if (top) assert.equal(r.items[0].id, top.id, `${label}: sabit başlık en üstte`)
  for (const i of r.items) assert.ok(i.def.sizes.includes(i.size), `${label}: geçerli boyut`)
  for (const i of r.items) for (const s of i.stack ?? []) assert.ok(!cardDef(s)!.locked, `${label}: yığında kilitli kart yok`)
  for (const d of r.drawer) assert.ok(!all.includes(d.def.id), `${label}: çekmecedeki kart ekranda değil`)
}

test('rastgele 1500 tasarım: çözülen düzen her zaman geçerli, normalize tekrar uygulanınca değişmez', () => {
  const r = rng(42)
  for (let k = 0; k < 1500; k++) {
    const screen = screens[k % screens.length]
    const items = randomItems(r, screen)
    const res = resolveScreen({ v: REGISTRY_VERSION, screens: { [screen]: { items } } }, screen, { advanced: r() < 0.5 })
    assertValid(screen, res, `#${k} ${screen}`)
    const n1 = normalizeScreen(screen, items)
    const n2 = normalizeScreen(screen, n1.items)
    assert.deepEqual(n2.items, n1.items, `#${k}: normalize kararlı`)
  }
})

test('sahte kayıt değişikliği (kart kaldırma + bölme + yeniden adlandırma) eski tasarımları bozmaz', () => {
  const saved = [...CARD_MIGRATIONS]
  const r = rng(7)
  try {
    CARD_MIGRATIONS.push({ version: REGISTRY_VERSION + 1, map: { 'today.coach': [], 'today.water': ['today.water', 'today.streaks'], 'fit.trend': ['fit.change'] }, note: { 'today.coach': 'Koç kartı kaldırıldı' } })
    for (let k = 0; k < 400; k++) {
      const screen = screens[k % screens.length]
      const d: Design = { v: REGISTRY_VERSION, screens: { [screen]: { items: randomItems(r, screen) } }, rules: [{ id: 'r', name: 'R', on: true, when: [{ kind: 'training' }], then: [{ kind: 'top', card: 'today.coach' }, { kind: 'hide', card: 'today.water' }] }], gestures: { pins: { today: ['today.coach'] } } }
      const m = migrateDesign(d)
      assert.equal(m.design.v, REGISTRY_VERSION)
      assertValid(screen, resolveScreen(d, screen, {}), `göç #${k}`)
      assert.ok(!JSON.stringify(m.design.rules ?? []).includes('today.coach'), 'kaldırılan kart kurallardan düşer')
      assert.ok(!(m.design.gestures?.pins?.today ?? []).includes('today.coach'), 'kaldırılan kart sabitlerden düşer')
    }
  } finally { CARD_MIGRATIONS.splice(0, CARD_MIGRATIONS.length, ...saved) }
})

test('şablon ve sihirbaz çıktıları her ekranda geçerli düzen üretir', () => {
  const r = rng(99)
  for (let k = 0; k < 200; k++) {
    const tpl: Design = { v: REGISTRY_VERSION, screens: Object.fromEntries(screens.filter(() => r() < 0.6).map((s) => [s, { items: randomItems(r, s) }])) }
    const cur: Design = { v: REGISTRY_VERSION, screens: { today: { items: randomItems(r, 'today') } }, style: { units: { weight: 'lb', volume: 'ml', energy: 'kcal', length: 'cm' } } }
    for (const mode of ['all', 'colors', 'layout'] as const) {
      const out = applyTemplate(cur, shareable(tpl), mode)
      for (const s of screens) assertValid(s, resolveScreen(out, s, {}), `şablon ${mode} ${s}`)
      assert.equal(out.style?.units?.weight, 'lb', 'kişisel birim korunur')
    }
  }
  for (const focus of ['weight', 'strength', 'health'] as const) for (const time of ['morning', 'evening', 'all'] as const) {
    const w = wizardDesign({ focus, logs: ['water', 'food', 'training'], detail: 'detailed', hand: 'left', time })
    assertValid('today', resolveScreen({ v: REGISTRY_VERSION, screens: { today: { items: w.today } } }, 'today', {}), 'sihirbaz')
  }
})
