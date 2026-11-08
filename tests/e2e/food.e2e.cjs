// Yemek modülü uçtan uca testi. Beklenen kaloriler veritabanındaki 100 g değerlerinden hesaplanır (elle yazılmaz).
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage()
  p.setDefaultNavigationTimeout(60000)
  const errors = []
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('dialog', (d) => { console.log('DIALOG:', d.message()); errors.push('dialog: ' + d.message()); d.dismiss() })
  p.on('console', (m) => { if (m.type() === 'error' && !/camera|getUserMedia|NotAllowed/i.test(m.text())) errors.push('console: ' + m.text()) })
  const shot = (n) => p.screenshot({ path: `${OUT}/food-${n}.png`, fullPage: true })
  const api = (path) => p.evaluate(async (u) => (await fetch(u)).json(), path)
  const eaten = async () => num((await p.locator('section[aria-label="Günlük özet"] .num').first().innerText()).split('/')[0])
  const expectEaten = async (v, step) => { for (let i = 0; i < 25; i++) { if ((await eaten()) === v) return; await p.waitForTimeout(200) } fail(`${step}: yenen ${await eaten()} beklenen ${v}`) }
  const foodBy = async (q, name) => { const r = await api('/api/food/search?q=' + encodeURIComponent(q)); const f = r.results.find((x) => x.name === name); if (!f) fail(`aramada yok: ${name} (${q}) → ${r.results.map((x) => x.name).slice(0, 5)}`); return f }
  const kcalFor = (f, g) => Math.round((f.per100.kcal * g) / 100)

  const u = 'test_f' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'lose', targetWeightKg: 72, tempo: 'balanced', customDays: 90, experience: null, trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  // Beklenen değerler için veritabanındaki gerçek besinler
  const corba = await foodBy('mercimek corbasi', 'Mercimek çorbası')
  const simit = await foodBy('simit', 'Simit')
  if (!(await api('/api/food/search?q=yogrt')).results.some((x) => /Yoğurt/.test(x.name))) fail('yazım hatalı aramada yoğurt yok')

  // 1) Arama + porsiyon ile ekleme (1 kase = 250 g)
  await p.goto(BASE + '/yemek'); await expectEaten(0, 'başlangıç')
  await p.goto(BASE + '/yemek/ekle?ogun=lunch')
  await p.fill('#food-q', 'mercimek çorbası')
  await p.getByRole('button', { name: /^Mercimek çorbası/ }).first().click()
  await p.getByRole('button', { name: '1 kase', exact: true }).waitFor()
  const k1 = kcalFor(corba, 250)
  await p.getByText(new RegExp(`^${k1}$`)).first().waitFor({ timeout: 5000 }).catch(() => fail('porsiyon kalorisi ' + k1 + ' görünmüyor'))
  await shot('01-besin-sayfasi')
  await p.getByRole('button', { name: 'Öğle yemeğine ekle' }).click()
  await p.getByText(`Mercimek çorbası · ${k1} kcal`).waitFor()

  // 2) Simit → kahvaltı
  await p.fill('#food-q', 'simit')
  await p.getByRole('button', { name: /^Simit/ }).first().click()
  await p.getByRole('button', { name: 'Kahvaltı', exact: true }).click()
  await p.getByRole('button', { name: 'Kahvaltıya ekle' }).click()
  await p.getByText(`Simit · ${kcalFor(simit, 100)} kcal`).waitFor()
  await p.goto(BASE + '/yemek'); await expectEaten(k1 + kcalFor(simit, 100), 'iki besin')

  // 3) Düzenle: simit 50 g
  await p.locator('section[aria-label="Kahvaltı"]').getByRole('button', { name: /Simit/ }).click()
  await p.fill('#ed-g', '50'); await p.getByRole('button', { name: 'Kaydet' }).click()
  await expectEaten(k1 + kcalFor(simit, 50), 'düzenle')

  // 4) Hızlı kalori 200
  await p.getByRole('button', { name: /Hızlı kalori/ }).first().click()
  await p.fill('#q-kcal', '200'); await p.getByRole('button', { name: /· ekle$/ }).click()
  await expectEaten(k1 + kcalFor(simit, 50) + 200, 'hızlı kalori')
  await shot('02-gunluk')

  // 5) Özel besin (100 g: 450 kcal) → 50 g = 225
  await p.goto(BASE + '/yemek/besin/yeni?ogun=snack')
  await p.fill('#cf-name', 'Test granola'); await p.fill('#cf-kcal', '450'); await p.fill('#cf-protein', '10'); await p.fill('#cf-carb', '60'); await p.fill('#cf-fat', '18')
  await p.getByRole('button', { name: 'Besini kaydet' }).click(); await p.waitForURL('**/yemek/ekle**')
  await p.fill('#food-q', 'test granola')
  await p.getByRole('button', { name: /^Test granola/ }).first().click()
  await p.getByRole('button', { name: 'Gram' }).click(); await p.fill('#fs-qty', '50')
  await p.getByRole('button', { name: 'Ara öğüne ekle' }).click()
  await p.getByText('Test granola · 225 kcal').waitFor()

  // 6) Tarif: 100 g kırmızı mercimek + 400 g su, 2 porsiyon → porsiyon = mercimek kcal / 2
  const mercimek = await foodBy('kirmizi mercimek', 'Kırmızı mercimek (kuru)')
  const su = await foodBy('su', 'Su')
  await p.goto(BASE + '/yemek/tarif/yeni?ogun=dinner')
  await p.fill('#rb-name', 'Test çorba'); await p.fill('#rb-sv', '2'); await p.fill('#rb-y', '450')
  await p.fill('#rb-q', 'kırmızı mercimek'); await p.getByRole('button', { name: /^Kırmızı mercimek \(kuru\)/ }).click()
  await p.fill('#rb-q', 'su'); await p.getByRole('button', { name: /^Su\s/ }).first().click()
  await p.fill('#rb-g-1', '400')
  const perServing = Math.round((mercimek.per100.kcal * 1 + (su.per100.kcal ?? 0) * 4) / 2)
  await p.locator('section[aria-label="Porsiyon değerleri"]').getByText(String(perServing), { exact: true }).waitFor({ timeout: 5000 }).catch(() => fail('tarif porsiyon kalorisi ' + perServing + ' değil'))
  await shot('03-tarif')
  await p.getByRole('button', { name: 'Tarifi kaydet' }).click(); await p.waitForURL('**/yemek/ekle**')
  await p.getByRole('button', { name: 'Besinlerim' }).click()
  await p.waitForTimeout(800); await shot('03b-besinlerim')
  await p.getByRole('button', { name: /^Test çorba Kendi tarifin/ }).waitFor()

  // 7) Önceki günden kopyalama
  const y = new Date(Date.now() - 3600000 - 86400000 /* Y1: mantıksal dün (+3 sa, gün 04.00) */).toISOString().slice(0, 10)
  await p.goto(`${BASE}/yemek/ekle?ogun=breakfast&gun=${y}`)
  await p.fill('#food-q', 'simit'); await p.getByRole('button', { name: /^Simit/ }).first().click()
  await p.getByRole('button', { name: 'Kahvaltıya ekle' }).click()
  // son kullanılan miktar (50 g) varsayılan gelir; eklenen kaloriyi ekrandan oku
  const yKcal = num((await p.getByText(/Simit · \d+ kcal/).innerText()).split('·')[1])
  if (yKcal !== kcalFor(simit, 50)) fail('son kullanılan miktar varsayılan gelmedi: ' + yKcal)
  await p.goto(BASE + '/yemek')
  const before = await eaten()
  await p.getByRole('button', { name: 'Kahvaltı seçenekleri' }).click()
  await p.getByRole('button', { name: /Önceki günün kahvaltı öğününü kopyala/ }).click()
  await expectEaten(before + yKcal, 'kopyala')

  // 8) Barkod (Open Food Facts; ağ yoksa açıkça yazdırılır)
  const bc = await api('/api/food/barcode?code=3017620422003')
  if (bc.hit) { if (!/nutella/i.test(bc.hit.name) || !/Open Food Facts/.test(bc.hit.attribution ?? '')) fail('barkod eşlemesi hatalı: ' + JSON.stringify(bc.hit).slice(0, 200)) }
  else console.log('UYARI: Open Food Facts erişilemedi/ürün yok:', JSON.stringify(bc))
  const bad = (await p.request.get(BASE + '/api/food/barcode?code=123')).status()
  if (bad !== 400) fail('geçersiz barkod kabul edildi')

  // 9) Yemekten gelen su: ayar açık → ayran Su'ya eklenir, yemek silinince su da silinir
  await p.goto(BASE + '/su/ayarlar'); await p.getByRole('checkbox', { name: /Yemeklerden gelen su/ }).check(); await p.waitForTimeout(800)
  await p.goto(BASE + '/yemek/ekle?ogun=snack')
  await p.fill('#food-q', 'ayran'); await p.getByRole('button', { name: /^Ayran/ }).first().click()
  await p.getByRole('button', { name: 'Ara öğüne ekle' }).click(); await p.getByText(/Ayran · \d+ kcal/).waitFor()
  await p.goto(BASE + '/su')
  const w = num(await p.locator('[aria-live=polite]').first().innerText())
  if (!(w >= 150 && w <= 200)) fail('ayrandan gelen su beklenmedik: ' + w)
  if (!(await p.getByText('Yemekten', { exact: false }).count())) fail('su kaydı kaynağı "Yemekten" değil')
  await p.goto(BASE + '/yemek')
  await p.locator('section[aria-label="Ara öğün"]').getByRole('button', { name: /Ayran/ }).click()
  await p.getByRole('button', { name: 'Sil' }).click(); await p.waitForTimeout(1500)
  await p.goto(BASE + '/su')
  if (num(await p.locator('[aria-live=polite]').first().innerText()) !== 0) fail('yemek silinince su silinmedi')

  // 10) Bugün ekranı yenen kaloriyi gösteriyor
  await p.goto(BASE + '/yemek'); const total = await eaten()
  await p.goto(BASE + '/')
  const shown = num(await p.locator('section[aria-label="Kalori"]').getByText('Yenen').locator('..').locator('.num').innerText())
  if (shown !== total) fail(`Bugün ekranı yenen ${shown}, günlük ${total}`)
  await shot('04-bugun')

  console.log('FOOD E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('FOOD E2E FAIL', e.message); process.exit(1) })
