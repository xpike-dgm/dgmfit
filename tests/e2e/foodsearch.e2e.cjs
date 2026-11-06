// Yemek araması + barkod (2026-11-06 geri bildirimi): ekli Türkçe sorgular ("tavuklu pilav") bulunur, birebir yoksa
// "yakın sonuçlar" + "Aradığını bulamadın mı?" çıkar; bulunamayan barkod sayılır, bir kullanıcı ürünü ekleyince
// barkodu okutan başka kullanıcı da bulur ve günlüğüne ekleyebilir.
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const user = async (prefix) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|camera|getUserMedia/i.test(m.text())) errors.push('console: ' + m.text()) })
    const u = prefix + Date.now().toString(36)
    await p.goto(BASE + '/kayit' + INVITE)
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
    await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
    return { p, u, api: (path) => p.evaluate(async (x) => (await fetch(x)).json(), path) }
  }
  const A = await user('test_fsa'), B = await user('test_fsb')

  // 1) Ekli sorgular: kökler eşleşir
  for (const [q, want] of [['tavuklu pilav', /^Tavuklu pilav$/], ['pirinc pilavi', /^Pirinç pilavı$/], ['mercimek çorbası', /^Mercimek çorbası$/], ['kıymalı pide', /pide/i], ['iskender', /İskender/]]) {
    const r = await A.api('/api/food/search?q=' + encodeURIComponent(q))
    if (!r.results.slice(0, 5).some((x) => want.test(x.name))) fail(`"${q}" ilk 5'te yok: ${r.results.slice(0, 5).map((x) => x.name).join(' | ')}`)
  }
  // birebir olmayan sorguda yakın sonuçlar işaretli döner
  const near = await A.api('/api/food/search?q=' + encodeURIComponent('tavuklu kinoa salatası'))
  if (!near.results.length || !near.results[0].partial) fail('yakın sonuç işareti yok: ' + JSON.stringify(near.results.slice(0, 2)))
  const { p } = A
  await p.goto(BASE + '/yemek/ekle?ogun=lunch')
  await p.fill('#food-q', 'tavuklu kinoa salatası'); await p.getByTestId('food-partial').waitFor()
  await p.getByTestId('food-notfound').waitFor()
  await p.screenshot({ path: `${OUT}/foodsearch-01-yakin.png` })
  await p.fill('#food-q', 'tavuklu pilav'); await p.getByRole('button', { name: /^Tavuklu pilav/ }).first().waitFor()
  await p.screenshot({ path: `${OUT}/foodsearch-02-tavuklu-pilav.png` })

  // 2) Barkod: bilinmeyen ürün → yok (OFF'ta da yok) → A ürünü ekler → B barkodla bulur ve ekler
  // 13 hane, "2" ile başlayan iç kullanım öneki (gerçek üründe yok) + EAN-13 denetim hanesi
  const base = '2' + String(Date.now()).slice(-11)
  const code = base + ((10 - ([...base].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10)
  const miss = await A.api('/api/food/barcode?code=' + code)
  if (miss.hit || miss.error === 'Geçersiz barkod') fail('olmayan barkod: ' + JSON.stringify(miss))
  await p.goto(`${BASE}/yemek/besin/yeni?barkod=${code}&ogun=snack`)
  await p.getByTestId('barcode-shared').waitFor()
  await p.fill('#cf-name', 'Test bisküvi ' + code.slice(-4)); await p.fill('#cf-brand', 'Deneme'); await p.fill('#cf-kcal', '480'); await p.fill('#cf-protein', '7'); await p.fill('#cf-carb', '65'); await p.fill('#cf-fat', '21')
  await p.getByRole('button', { name: 'Besini kaydet' }).click(); await p.waitForURL('**/yemek/ekle**')
  const hitB = await B.api('/api/food/barcode?code=' + code)
  if (!hitB.hit || hitB.from !== 'community' || !/kullanıcı ekledi/.test(hitB.hit.sub)) fail('topluluk ürünü B için bulunamadı: ' + JSON.stringify(hitB).slice(0, 200))
  // B aramada da bulur ve günlüğe ekler
  await B.p.goto(BASE + '/yemek/ekle?ogun=snack')
  await B.p.fill('#food-q', 'test bisküvi ' + code.slice(-4)); await B.p.getByRole('button', { name: /^Test bisküvi/ }).first().click()
  await B.p.getByRole('button', { name: 'Ara öğüne ekle' }).click(); await B.p.getByText(/Test bisküvi \d+ · \d+ kcal/).waitFor().catch(() => fail('topluluk ürünü günlüğe eklenemedi'))

  console.log('FOOD SEARCH E2E OK users=', A.u, B.u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('FOOD SEARCH E2E FAIL', e.message); process.exit(1) })
