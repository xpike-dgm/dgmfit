import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_STYLE, hapticScale, isWarmHour, normalizeStyle, styleAttrs } from '../lib/cards/style.ts'
import { fmtEnergyNum, fmtLength, fmtVolume, fmtWeight, volumeNum, weightIn, weightOut } from '../lib/units.ts'

test('stil: bilinmeyen değerler varsayılana düşer; fotoğraflı bant fotoğrafsız olamaz', () => {
  assert.deepEqual(normalizeStyle(null), DEFAULT_STYLE)
  const s = normalizeStyle({ radius: 'round', density: 'x', font: 'serif', band: 'photo', bandMedia: '../etc', units: { weight: 'lb', volume: 'gal' }, sound: 'yes', warm: true })
  assert.equal(s.radius, 'round'); assert.equal(s.density, 'normal'); assert.equal(s.font, 'serif')
  assert.equal(s.band, 'gradient', 'geçersiz fotoğraf kimliği → degrade'); assert.equal(s.bandMedia, null)
  assert.deepEqual(s.units, { weight: 'lb', volume: 'ml', energy: 'kcal', length: 'cm' })
  assert.equal(s.sound, false); assert.equal(s.warm, true)
  const ph = normalizeStyle({ band: 'photo', bandMedia: '0b5c7a9e-1c2d-4e5f-8a9b-0c1d2e3f4a5b' })
  assert.equal(ph.band, 'photo')
})

test('stil öznitelikleri yalnız varsayılandan farklıysa', () => {
  assert.deepEqual(styleAttrs(DEFAULT_STYLE), {})
  assert.deepEqual(styleAttrs(normalizeStyle({ radius: 'sharp', motion: 'reduce', contrast: 'high', icons: 'bold' })), { 'data-radius': 'sharp', 'data-icons': 'bold', 'data-motion': 'reduce', 'data-contrast': 'high' })
})

test('akşam saati ve titreşim çarpanı', () => {
  assert.ok(isWarmHour(20 * 60) && isWarmHour(3 * 60) && !isWarmHour(6 * 60) && !isWarmHour(19 * 60 + 59))
  assert.equal(hapticScale('off'), 0); assert.ok(hapticScale('strong') > hapticScale('light'))
})

test('birimler: gidiş-dönüş, Türkçe biçim', () => {
  assert.equal(fmtWeight(72, 'kg'), '72,0 kg')
  assert.equal(fmtWeight(72, 'lb'), '158,7 lb')
  assert.ok(Math.abs(weightIn(weightOut(81.3, 'lb'), 'lb') - 81.3) < 1e-9)
  assert.equal(fmtVolume(250, 'ml'), '250 ml')
  assert.equal(fmtVolume(500, 'oz'), '16,9 oz')
  assert.equal(volumeNum(2300, 'ml'), '2.300')
  assert.equal(fmtEnergyNum(2000, 'kJ'), '8.368')
  assert.equal(fmtEnergyNum(1395, 'kcal'), '1.395')
  assert.equal(fmtLength(178, 'in'), '70,1 in')
})
