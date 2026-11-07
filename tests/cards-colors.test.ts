import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODULES, PALETTES, autoInk, cardVars, contrast, darkBg, ensureContrast, isHex, luminance, mix, moduleCss, modulePalette, normalizeCardColors, normalizeModuleColors, paletteColors, photoModuleColors, quantize, readabilityNotes, themeColors } from '../lib/cards/colors.ts'

test('kontrast ve parlaklık WCAG değerleriyle uyumlu', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21)
  assert.equal(contrast('#777777', '#777777'), 1)
  assert.ok(luminance('#FFFFFF') > 0.99 && luminance('#000000') === 0)
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080')
  assert.equal(autoInk('#FFF3B0'), '#14161B')
  assert.equal(autoInk('#123456'), '#FFFFFF')
})

test('ensureContrast hedefe ulaşır; yeterliyse dokunmaz', () => {
  assert.equal(ensureContrast('#000000', '#FFFFFF'), '#000000')
  for (const [fg, bg] of [['#CCCCCC', '#FFFFFF'], ['#333333', '#222222'], ['#FFD43B', '#FFF9DB']]) assert.ok(contrast(ensureContrast(fg, bg), bg) >= 4.5, fg + ' / ' + bg)
})

test('kart renkleri: her iki temada okunur; açık zemin koyu temada koyulaşır; uyarılar', () => {
  const c = { bg: '#FFE8CC', title: '#FFF0E0', accent: '#FFD8A8' }
  for (const mode of ['light', 'dark'] as const) {
    const t = themeColors(c, mode)
    assert.ok(contrast(t.title!, t.bg!) >= 4.5, mode + ' başlık')
    assert.ok(contrast(t.text!, t.bg!) >= 4.5, mode + ' metin (otomatik)')
    assert.ok(contrast(t.accent!, t.bg!) >= 3, mode + ' vurgu')
    assert.ok(contrast(t.accentInk!, t.accent!) >= 3, mode + ' vurgu yazısı')
  }
  assert.ok(luminance(darkBg('#FFE8CC')) < 0.12)
  assert.equal(darkBg('#102030'), '#102030', 'koyu zemin aynen kalır')
  assert.ok(readabilityNotes(c).some((n) => n.includes('Başlık')))
  assert.deepEqual(readabilityNotes({ bg: '#FFFFFF', title: '#000000' }).filter((n) => n.includes('açık temada')), [])
  // yalnız vurgu seçilirse zemin/yazı temaya kalır
  const v = cardVars({ accent: '#0B79C9' })!
  assert.equal(v.slots, 'acc')
  assert.ok(v.style['--ccl-acc'] && v.style['--ccd-acc'] && !v.style['--ccl-bg'])
  assert.equal(cardVars({}), null)
})

test('doğrulama: yalnız #RRGGBB kabul; bilinmeyen alan/modül atılır', () => {
  assert.ok(isHex('#a1b2c3') && !isHex('red') && !isHex('#abc') && !isHex('url(x)'))
  assert.deepEqual(normalizeCardColors({ bg: '#ffffff', title: 'javascript:1', x: '#000000' }), { bg: '#FFFFFF' })
  assert.equal(normalizeCardColors({ bg: 'nope' }), undefined)
  assert.deepEqual(normalizeModuleColors({ water: '#0b79c9', evil: '#000000', food: '}' }), { water: '#0B79C9' })
})

test('modül paleti: açık temada beyaz yazı, koyu temada koyu yazı okunur; CSS yalnız seçilen modüller', () => {
  for (const m of MODULES) {
    const p = modulePalette(m.base)
    assert.ok(contrast(p.accL, '#FFFFFF') >= 4.5, m.id + ' açık')
    assert.ok(contrast(p.accD, '#14161B') >= 6, m.id + ' koyu')
  }
  for (const pal of PALETTES) for (const c of pal.colors) { const p = modulePalette(c); assert.ok(contrast(p.accL, '#FFFFFF') >= 4.5 && contrast(p.accD, '#14161B') >= 6, pal.id + c) }
  // çok açık seçim de okunur bant üretir
  assert.ok(contrast(modulePalette('#FFF3BF').m1, '#FFFFFF') >= 3)
  const css = moduleCss({ water: '#FF0000' })
  assert.match(css, /^\[data-mod="water"\]\{--m1:#[0-9A-F]{6};--m2:#[0-9A-F]{6};--acc-l:#[0-9A-F]{6};--acc-d:#[0-9A-F]{6}\}$/)
  assert.equal(moduleCss(undefined), '')
  assert.equal(Object.keys(paletteColors('okyanus')!).length, MODULES.length)
})

test('fotoğraftan palet: baskın doygun renkler önce, yakın renkler elenir, gri/beyaz geri planda', () => {
  const px: number[] = []
  const put = (r: number, g: number, b: number, n: number) => { for (let i = 0; i < n; i++) px.push(r, g, b, 255) }
  put(250, 250, 250, 5000) // beyaz zemin
  put(20, 110, 200, 2000) // mavi
  put(24, 114, 204, 800) // neredeyse aynı mavi
  put(220, 80, 30, 1500) // turuncu
  put(40, 150, 60, 900) // yeşil
  const q = quantize(px, 4)
  assert.equal(q.length, 4)
  assert.ok(contrast(q[0], '#1470C8') < 1.3, 'ilk renk mavi: ' + q[0])
  assert.ok(q.slice(0, 3).some((c) => contrast(c, '#DC501E') < 1.3), 'turuncu var')
  assert.ok(q.indexOf(q.find((c) => luminance(c) > 0.85)!) === 3 || !q.some((c) => luminance(c) > 0.85), 'beyaz sonda ya da yok')
  assert.equal(Object.keys(photoModuleColors(q)).length, MODULES.length)
  assert.deepEqual(photoModuleColors([]), {})
})
