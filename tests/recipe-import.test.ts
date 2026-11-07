import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractRecipe, isPrivateAddress, parseIngredient, recipeUrlOk } from '../lib/recipe-import.ts'

test('extractRecipe: @graph içindeki Recipe, porsiyon, HTML varlıkları', () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Mercimek &amp; Çorba","recipeYield":["6 kişilik"],"recipeIngredient":["1 su bardağı kırmızı mercimek","2  yemek kaşığı tereyağı"]}]}</script></html>`
  const r = extractRecipe(html)!
  assert.equal(r.name, 'Mercimek & Çorba')
  assert.equal(r.servings, 6)
  assert.deepEqual(r.ingredients, ['1 su bardağı kırmızı mercimek', '2 yemek kaşığı tereyağı'])
  assert.equal(extractRecipe('<script type="application/ld+json">{bozuk</script>'), null)
})

test('parseIngredient: Türkçe ölçüler', () => {
  const p = (s: string) => { const r = parseIngredient(s); return [r.qty, r.unit, r.name, r.grams] }
  assert.deepEqual(p('1,5 su bardağı pirinç (yıkanmış)'), [1.5, 'su bardağı', 'pirinç', 270])
  assert.deepEqual(p('200 gr kıyma'), [200, 'g', 'kıyma', 200])
  assert.deepEqual(p('1/2 çay bardağı zeytinyağı'), [0.5, 'çay bardağı', 'zeytinyağı', 50])
  assert.deepEqual(p('Yarım demet maydanoz'), [0.5, 'demet', 'maydanoz', 25])
  assert.deepEqual(p('2 yemek kaşığı domates salçası'), [2, 'yemek kaşığı', 'domates salçası', 40])
  assert.deepEqual(p('1 adet soğan'), [1, 'adet', 'soğan', null])
  assert.deepEqual(p('Tuz'), [null, null, 'tuz', null])
  assert.deepEqual(p('1 buçuk su bardağı su'), [1.5, 'su bardağı', 'su', 300])
  assert.deepEqual(p('2-3 diş sarımsak'), [2.5, 'diş', 'sarımsak', 13])
})

test('isPrivateAddress / recipeUrlOk: SSRF koruması', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) assert.ok(isPrivateAddress(ip), ip)
  for (const ip of ['93.184.216.34', '2606:4700::1111']) assert.ok(!isPrivateAddress(ip), ip)
  assert.ok(recipeUrlOk('https://www.nefisyemektarifleri.com/mercimek-corbasi/'))
  for (const u of ['http://a.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://a.com:8443/x', 'https://u:p@a.com/', 'https://[::1]/', 'ftp://a.com', 'https://intranet/x']) assert.equal(recipeUrlOk(u), null, u)
})
