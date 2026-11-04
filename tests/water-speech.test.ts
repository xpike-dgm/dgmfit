import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWaterSpeech, wordsToNumbers } from '../lib/water-speech.ts'

const ctx = { nowMin: 18 * 60, sipMl: 22, containers: [
  { name: 'Bardak', kind: 'glass', capacityMl: 200 }, { name: 'Şişe', kind: 'bottle', capacityMl: 500 },
  { name: 'Termos', kind: 'thermos', capacityMl: 750 }, { name: 'Spor şişem', kind: 'bottle', capacityMl: 900 },
] }
const p = (t: string) => parseWaterSpeech(t, ctx)

test('yazıyla sayılar', () => {
  assert.equal(wordsToNumbers('üç yüz elli ml'), '350 ml')
  assert.equal(wordsToNumbers('bir buçuk litre'), '1.5 litre')
  assert.equal(wordsToNumbers('iki bin'), '2000')
  assert.equal(wordsToNumbers('yarım şişe'), '0.5 şişe')
  assert.equal(wordsToNumbers('yüz'), '100')
})

test('örnek cümle: "Az önce 300 ml su içtim."', () => {
  const r = p('Az önce 300 ml su içtim.')!
  assert.equal(r.ml, 300); assert.equal(r.drink, 'water'); assert.equal(r.atMin, null)
})

test('birimler', () => {
  assert.equal(p('üç yüz elli mililitre içtim')!.ml, 350)
  assert.equal(p('bir buçuk litre')!.ml, 1500)
  assert.equal(p('iki bardak su')!.ml, 400)
  assert.equal(p('yarım şişe içtim')!.ml, 250)
  assert.equal(p('şişemi bitirdim')!.ml, 500)
  assert.equal(p('5 yudum')!.ml, 110)
  assert.equal(p('bir çay bardağı çay')!.ml, 100)
  assert.equal(p('spor şişem bitti')!.ml, 900)
  assert.equal(p('250')!.ml, 250)
})

test('içecek türü', () => {
  assert.equal(p('bir kupa kahve')!.drink, 'coffee')
  assert.equal(p('iki bardak çay içtim')!.drink, 'tea')
  assert.equal(p('200 ml maden suyu')!.drink, 'mineral')
  assert.equal(p('bir bardak ayran')!.drink, 'ayran')
})

test('zaman ifadeleri miktarla karışmaz', () => {
  const a = p('yarım saat önce 400 ml içtim')!
  assert.equal(a.ml, 400); assert.equal(a.atMin, 18 * 60 - 30)
  const b = p('2 saat önce bir şişe')!
  assert.equal(b.ml, 500); assert.equal(b.atMin, 16 * 60)
  const c = p("saat 2'de bir bardak içmiştim")!
  assert.equal(c.ml, 200); assert.equal(c.atMin, 14 * 60) // akşam 18:00'de "2" → 14:00
  const d = p('saat 09:30 da 300 ml')!
  assert.equal(d.ml, 300); assert.equal(d.atMin, 9 * 60 + 30)
  const e = p('15 dakika önce 200 ml')!
  assert.equal(e.atMin, 18 * 60 - 15)
})

test('anlaşılmayan cümle → null', () => {
  assert.equal(p('merhaba'), null)
  assert.equal(p(''), null)
  assert.equal(p('10 litre'), null) // 3000 üstü
})
