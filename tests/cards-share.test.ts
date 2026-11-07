import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTemplate, personalPart, shareable, withPersonal } from '../lib/cards/share.ts'
import type { Design } from '../lib/cards/layout.ts'

const mine: Design = {
  v: 1, screens: { today: { items: [{ id: 'today.header' }, { id: 'today.water' }] } },
  cards: { 'today.water': { quick: '500', colors: { bg: '#112233' } } },
  gestures: { pins: { today: ['today.water'] } }, prefs: { hand: 'left', holdToEdit: false },
  style: { units: { weight: 'lb', volume: 'oz', energy: 'kJ', length: 'in' }, haptics: 'off', band: 'photo', bandMedia: '0b5c7a9e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', radius: 'sharp' },
  modules: { water: '#FF0000' }, nav: { order: ['today', 'water'], hidden: ['social'] },
}
const theirs: Design = {
  v: 1, screens: { today: { items: [{ id: 'today.header' }, { id: 'today.macros' }] } },
  cards: { 'today.macros': { colors: { accent: '#00AA00' } }, 'today.water': { quick: '330' } },
  modules: { food: '#00FF00' }, style: { radius: 'round', font: 'serif', units: { weight: 'kg', volume: 'ml', energy: 'kcal', length: 'cm' } },
  gestures: { pins: { today: ['today.macros'] } }, prefs: { hand: 'right' },
}

test('paylaşılabilir hâl kişisel kısmı ve bant fotoğrafını içermez', () => {
  const s = shareable(mine)
  assert.equal(s.gestures, undefined); assert.equal(s.prefs, undefined)
  assert.equal(s.style!.units, undefined); assert.equal(s.style!.haptics, undefined); assert.equal(s.style!.bandMedia, undefined)
  assert.equal(s.style!.band, 'gradient', 'fotoğraflı bant degradeye döner')
  assert.equal(s.style!.radius, 'sharp')
  assert.deepEqual(s.modules, { water: '#FF0000' })
  assert.ok(!JSON.stringify(s).includes('0b5c7a9e'), 'fotoğraf kimliği sızmaz')
})

test('kişisel kısım tasarımlar arasında taşınır', () => {
  const p = personalPart(mine)
  const d = withPersonal({ v: 1, screens: {} }, p)
  assert.deepEqual(d.prefs, { hand: 'left', holdToEdit: false })
  assert.equal(d.style!.units!.weight, 'lb'); assert.equal(d.style!.haptics, 'off')
  assert.deepEqual(d.gestures, mine.gestures)
})

test('şablon uygulama: tümü / yalnız renkler / yalnız düzen; kişisel kısım korunur', () => {
  const all = applyTemplate(mine, theirs, 'all')
  assert.deepEqual(all.screens, theirs.screens); assert.deepEqual(all.modules, { food: '#00FF00' })
  assert.equal(all.style!.radius, 'round'); assert.equal(all.style!.font, 'serif')
  assert.equal(all.style!.units!.weight, 'lb', 'birimlerim değişmez'); assert.deepEqual(all.prefs, mine.prefs); assert.deepEqual(all.gestures, mine.gestures)
  assert.equal(all.cards!['today.water'].quick, '330'); assert.equal(all.cards!['today.water'].colors, undefined)
  const colors = applyTemplate(mine, theirs, 'colors')
  assert.deepEqual(colors.screens, mine.screens, 'düzen değişmez'); assert.deepEqual(colors.nav, mine.nav)
  assert.deepEqual(colors.modules, { food: '#00FF00' }); assert.equal(colors.cards!['today.water'].quick, '500', 'hızlı eylem değişmez')
  assert.deepEqual(colors.cards!['today.macros'].colors, { accent: '#00AA00' })
  const layout = applyTemplate(mine, theirs, 'layout')
  assert.deepEqual(layout.screens, theirs.screens); assert.deepEqual(layout.modules, mine.modules, 'renkler değişmez')
  assert.equal(layout.style!.radius, 'sharp'); assert.deepEqual(layout.cards!['today.water'].colors, { bg: '#112233' })
  assert.equal(layout.nav, undefined, 'şablonda alt bar yoksa varsayılan')
})
