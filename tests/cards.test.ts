import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARDS, CARD_MIGRATIONS, REGISTRY_VERSION, SCREENS, cardDef } from '../lib/cards/registry.ts'
import { addItem, defaultItems, migrateDesign, moveItem, normalizeScreen, removeItem, resolveScreen, setSize, type Design } from '../lib/cards/layout.ts'

const ids = (r: { items: { id: string }[] }) => r.items.map((i) => i.id)

test('kayıt: kimlikler benzersiz, ekran tanımlı, varsayılan boyut desteklenen boyutlarda', () => {
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length)
  for (const c of CARDS) {
    assert.ok(c.screen in SCREENS, c.id)
    assert.ok(c.sizes.includes(c.size), c.id)
    assert.ok(c.id.startsWith(c.screen + '.'), 'kimlik ekranla başlar: ' + c.id)
    assert.ok(c.since >= 1 && c.since <= REGISTRY_VERSION, c.id)
  }
})

test('kayıt: göç eşlemeleri yalnızca kayıtta olan kartlara gider, sürümler artan', () => {
  let prev = 1
  for (const m of CARD_MIGRATIONS) {
    assert.ok(m.version > prev && m.version <= REGISTRY_VERSION); prev = m.version
    for (const to of Object.values(m.map)) for (const id of to) assert.ok(cardDef(id) || CARD_MIGRATIONS.some((x) => x.version > m.version && x.map[id]), 'eşleme hedefi yok: ' + id)
  }
})

test('özelleştirmemiş kullanıcı varsayılanı alır; başlık en üstte, çekmecede yalnız varsayılan dışı kartlar', () => {
  const r = resolveScreen(null, 'today')
  assert.deepEqual(ids(r), defaultItems('today').map((i) => i.id))
  assert.equal(r.items[0].id, 'today.header')
  assert.equal(r.customized, false)
  assert.deepEqual(r.drawer.map((d) => d.def.id), ['today.streaks'])
})

test('çözümleme: bilinmeyen kart atlanır (not), tekrar ayıklanır, kilitli kartlar geri gelir, desteklenmeyen boyut düzelir', () => {
  const d: Design = { v: REGISTRY_VERSION, screens: { today: { items: [{ id: 'today.water', size: 'full' }, { id: 'today.yok' }, { id: 'today.water' }, { id: 'today.macros', size: 'half' }] } } }
  const r = resolveScreen(d, 'today')
  assert.deepEqual(ids(r), ['today.header', 'today.water', 'today.goal-choice', 'today.macros'], 'hedef kartı varsayılan sırasına döner')
  assert.equal(r.items.find((i) => i.id === 'today.water')!.size, 'full')
  assert.equal(r.items.find((i) => i.id === 'today.macros')!.size, 'full', 'makrolar yarım olamaz')
  assert.equal(r.notices.length, 1)
  assert.ok(r.drawer.some((x) => x.def.id === 'today.fit' && x.reason === 'removed'))
})

test('düzenleme işlemleri: taşı, kaldır, ekle, boyut; sabit başlığın önüne geçilemez', () => {
  let items = defaultItems('today')
  items = moveItem(items, items.findIndex((i) => i.id === 'today.water'), 0)
  assert.equal(items[0].id, 'today.header')
  assert.equal(items[1].id, 'today.water')
  assert.equal(moveItem(items, 0, 3), items, 'başlık taşınmaz')
  items = removeItem(items, 'today.fit')
  assert.ok(!items.some((i) => i.id === 'today.fit'))
  assert.equal(removeItem(items, 'today.goal-choice'), items, 'hedef kartı kaldırılamaz')
  items = addItem(items, 'today.streaks', 0)
  assert.equal(items[1].id, 'today.streaks', 'en üste eklense de başlığın altına')
  assert.equal(addItem(items, 'today.streaks'), items, 'iki kez eklenmez')
  items = setSize(items, 'today.water', 'full')
  assert.equal(items.find((i) => i.id === 'today.water')!.size, 'full')
  const n = normalizeScreen('today', items)
  assert.deepEqual(n.removed, ['today.fit'])
  assert.equal(n.items.find((i) => i.id === 'today.water')!.size, 'full')
  assert.equal(n.items.find((i) => i.id === 'today.macros')!.size, undefined, 'varsayılan boyut saklanmaz')
})

test('güncelleme uyumluluğu: değiştirilen, bölünen ve kaldırılan kartlar (sahte göçle)', () => {
  const saved = CARD_MIGRATIONS.splice(0)
  try {
    CARD_MIGRATIONS.push({ version: 2, map: { 'today.water': ['today.water'], 'today.fit': ['today.fit', 'today.streaks'], 'today.partner': [] }, note: { 'today.partner': 'Partner kartı kaldırıldı' } })
    const d: Design = { v: 1, screens: { today: { items: [{ id: 'today.header' }, { id: 'today.fit', size: 'full' }, { id: 'today.partner' }, { id: 'today.water' }] } }, cards: { 'today.fit': { colors: { bg: '#000000' } } } }
    const m = migrateDesign(d)
    assert.deepEqual(m.design.screens.today!.items.map((i) => i.id), ['today.header', 'today.fit', 'today.streaks', 'today.water'])
    assert.equal(m.design.screens.today!.items[2].size, 'full', 'bölünen kart eskisinin boyutunu alır')
    assert.deepEqual(m.design.cards!['today.streaks'], { colors: { bg: '#000000' } }, 'ayarlar yeni karta taşınır')
    assert.deepEqual(m.notices, ['Partner kartı kaldırıldı'])
  } finally { CARD_MIGRATIONS.splice(0, CARD_MIGRATIONS.length, ...saved) }
})

test('her ekran: tek sabit başlık, boş olmayan varsayılan; her kayıtlı kartın bir çizicisi var', async () => {
  const { readFileSync } = await import('node:fs')
  const src = ['app/(app)/page.tsx', 'app/(app)/fit/page.tsx', 'app/(app)/fitness/page.tsx', 'app/(app)/su/WaterScreen.tsx', 'app/(app)/yemek/FoodDiary.tsx']
    .map((f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n')
  for (const s of Object.keys(SCREENS) as (keyof typeof SCREENS)[]) {
    const tops = CARDS.filter((c) => c.screen === s && c.locked === 'top')
    assert.equal(tops.length, 1, 'ekranın tek sabit başlığı olmalı: ' + s)
    for (const adv of [false, true]) {
      const r = resolveScreen(null, s, { advanced: adv })
      assert.equal(r.items[0].id, tops[0].id, s)
      assert.ok(r.items.length >= 3, s)
    }
  }
  for (const c of CARDS) assert.ok(src.includes(`'${c.id}'`), 'kayıtlı kartın çizicisi yok: ' + c.id)
})

test('Gelişmiş kartlar: Sade modda çekmecede bekler, Gelişmiş modda varsayılandadır', () => {
  const sade = resolveScreen(null, 'fit', { advanced: false }), adv = resolveScreen(null, 'fit', { advanced: true })
  assert.ok(!ids(sade).includes('fit.tdee') && ids(adv).includes('fit.tdee'))
  assert.equal(sade.drawer.find((d) => d.def.id === 'fit.tdee')?.reason, 'available')
  // Sade kullanıcı gelişmiş kartı ekleyip kaydederse korunur; "kaldırılan" listesine gelişmiş kartlar girmez
  const n = normalizeScreen('fit', [...defaultItems('fit'), { id: 'fit.tdee' }], { advanced: false })
  assert.ok(n.items.some((i) => i.id === 'fit.tdee'))
  assert.ok(!(n.removed ?? []).includes('fit.balance'))
})
