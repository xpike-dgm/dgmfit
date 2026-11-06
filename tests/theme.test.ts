import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hidesNav, moduleFor, parseTheme, tabFor } from '../lib/theme.ts'

test('adres → modül ve sekme', () => {
  assert.equal(moduleFor('/'), 'today')
  assert.equal(moduleFor('/fit'), 'plan')
  assert.equal(moduleFor('/fitness/programlar/3'), 'fitness')
  assert.equal(moduleFor('/fitness'), 'fitness')
  assert.equal(moduleFor('/su/ayarlar/kaplar'), 'water')
  assert.equal(moduleFor('/yemek/ekle?ogun=dinner'), 'food')
  assert.equal(moduleFor('/u/ayse'), 'social')
  assert.equal(moduleFor('/uygulama'), 'today')
  assert.equal(moduleFor('/koc'), 'coach')
  assert.equal(moduleFor('/profil/gorunum'), 'profile')
  assert.equal(tabFor('/rapor'), 'today')
  assert.equal(tabFor('/profil'), 'today')
  assert.equal(tabFor('/sosyal/mesaj/ayse'), 'social')
})

test('canlı antrenman alt barı gizler, özet gizlemez; tema çerezi', () => {
  assert.equal(hidesNav('/fitness/antrenman'), true)
  assert.equal(hidesNav('/fitness/antrenman?program=1'), true)
  assert.equal(hidesNav('/fitness/rekor?ex=5'), true)
  assert.equal(hidesNav('/fitness/antrenman/12'), false)
  assert.equal(hidesNav('/koc'), true)
  assert.equal(hidesNav('/koc?s=1'), true)
  assert.equal(hidesNav('/rapor'), false)
  assert.equal(parseTheme('light'), 'light')
  assert.equal(parseTheme('xx'), 'auto')
  assert.equal(parseTheme(undefined), 'auto')
})
