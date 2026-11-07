// Özelleştirme Ö5a: kendi takip alanım (sayaç) → kart oluşturucu → Bugün'de kendi kartım + hızlı kayıt / geri al; söz, geri sayım,
// fotoğraf ve ölçüm (Su ekranı) kartları; düzenlemede kendi adı; şablona girmez; silinen kart ekrandan kalkar. Canlıda da çalışır.
const { chromium, devices } = require('playwright')
const zlib = require('zlib')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
function png(w, h, colorAt) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) raw.set(colorAt(x, y), y * (w * 3 + 1) + 1 + x * 3) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  p.on('dialog', (d) => d.accept())
  const u = 'test_c11' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1990-05-05', heightCm: 166, weightKg: 64, activity: 'moderate', goal: 'lose', targetWeightKg: 60, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const msg = (id, t) => p.getByTestId(id).filter({ hasText: t }).waitFor({ timeout: 15000 }).catch(() => fail(`${id} mesajı yok: ${t}`))
  const card = (title) => p.locator('[data-testid=user-card]').filter({ has: p.locator('[data-testid=uc-title]', { hasText: title }) }).first()

  // 1) Stüdyodan takip alanı: Kahve (sayaç, fincan, en çok 3)
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-builder').click(); await p.getByTestId('studio-trackers').click(); await p.getByTestId('trackers').waitFor()
  await p.getByTestId('tr-name').fill('Kahve'); await p.getByTestId('tr-kind-count').click(); await p.getByTestId('tr-unit').fill('fincan'); await p.getByTestId('tr-goal').fill('3')
  await p.getByTestId('tr-create').click(); await msg('tr-msg', 'eklendi')
  await p.locator('[data-tracker="Kahve"]').waitFor()

  // 2) Kart oluşturucu: takip kartı (çubuk), söz, geri sayım, fotoğraf → Bugün; su ölçümü → Su ekranı
  await p.goto(BASE + '/profil/ozellestirme/kartlarim'); await p.getByTestId('builder-form').waitFor()
  await p.getByTestId('uc-kind-tracker').click(); await p.getByTestId('uc-view-bar').click(); await p.getByTestId('uc-name').fill('Kahvem')
  await p.getByTestId('uc-preview').locator('[data-testid=uc-title]', { hasText: 'Kahvem' }).waitFor()
  await p.screenshot({ path: `${OUT}/custom11-01-olusturucu.png`, fullPage: true })
  await p.getByTestId('uc-save').click(); await msg('uc-msg', 'eklendi')
  await p.getByTestId('uc-kind-quote').click(); await p.getByTestId('uc-text').fill('Disiplin özgürlüktür'); await p.getByTestId('uc-save').click()
  await p.locator('[data-my-card="Sözüm"]').waitFor()
  const in10 = new Date(Date.now() + 10 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  await p.getByTestId('uc-kind-countdown').click(); await p.getByTestId('uc-date').fill(in10); await p.getByTestId('uc-name').fill('Tatile'); await p.getByTestId('uc-save').click()
  await p.locator('[data-my-card="Tatile"]').waitFor()
  await p.getByTestId('uc-kind-photo').click()
  await p.getByTestId('uc-photo').setInputFiles({ name: 'hedef.png', mimeType: 'image/png', buffer: png(48, 48, (x, y) => ((x + y) % 2 ? [30, 140, 90] : [220, 200, 60])) })
  await p.getByTestId('uc-preview').locator('img').waitFor({ timeout: 20000 }).catch(() => fail('fotoğraf yüklenmedi'))
  await p.getByTestId('uc-name').fill('Hedefim'); await p.getByTestId('uc-save').click(); await p.locator('[data-my-card="Hedefim"]').waitFor()
  await p.getByTestId('uc-kind-metric').click(); await p.getByTestId('uc-metric').selectOption('water'); await p.getByTestId('uc-screen').selectOption('water')
  await p.getByTestId('uc-name').fill('Su özetim'); await p.getByTestId('uc-save').click(); await p.locator('[data-my-card="Su özetim"]').waitFor()
  if ((await p.locator('[data-my-card]').count()) !== 5) fail('kart listesi 5 değil')

  // 3) Bugün: kartlar görünür; sayaç + / geri al
  await p.goto(BASE + '/'); await p.getByTestId('card-board').waitFor()
  for (const t of ['Kahvem', 'Sözüm', 'Tatile', 'Hedefim']) if (!(await card(t).count())) fail(`Bugün'de ${t} kartı yok`)
  if (!(await card('Sözüm').innerText()).includes('Disiplin özgürlüktür')) fail('söz metni yok')
  if ((await card('Tatile').getByTestId('uc-value').innerText()).trim() !== '10') fail('geri sayım 10 değil: ' + await card('Tatile').getByTestId('uc-value').innerText())
  if (!(await card('Hedefim').locator('img').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false))) {
    await p.waitForTimeout(1500)
    if (!(await card('Hedefim').locator('img').evaluate((i) => i.naturalWidth > 0))) fail('hedef fotoğrafı açılmadı')
  }
  const val = () => card('Kahvem').getByTestId('uc-value').innerText().then((s) => s.trim())
  await card('Kahvem').getByTestId('uc-plus').click(); await p.waitForFunction(() => [...document.querySelectorAll('[data-testid=user-card]')].some((e) => e.textContent.includes('Kahvem') && e.querySelector('[data-testid=uc-value]')?.textContent.trim() === '1'))
  await card('Kahvem').getByTestId('uc-plus').click(); await p.waitForFunction(() => [...document.querySelectorAll('[data-testid=user-card]')].some((e) => e.textContent.includes('Kahvem') && e.querySelector('[data-testid=uc-value]')?.textContent.trim() === '2'))
  await card('Kahvem').getByTestId('uc-undo').click(); await p.waitForFunction(() => [...document.querySelectorAll('[data-testid=user-card]')].some((e) => e.textContent.includes('Kahvem') && e.querySelector('[data-testid=uc-value]')?.textContent.trim() === '1'))
  if ((await val()) !== '1') fail('sayaç geri alınamadı')
  const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 412) fail('yatay taşma: ' + w)
  await p.screenshot({ path: `${OUT}/custom11-02-bugun.png`, fullPage: true })

  // 4) Su ekranında ölçüm kartı; takip sayfasında bugünkü değer
  await p.goto(BASE + '/su'); await card('Su özetim').waitFor({ timeout: 15000 }).catch(() => fail('Su ekranında ölçüm kartı yok'))
  await p.goto(BASE + '/profil/ozellestirme/takip')
  if ((await p.locator('[data-tracker="Kahve"] [data-testid=tracker-today]').innerText()).trim() !== '1') fail('takip sayfasında bugün 1 değil')

  // 5) Düzenleme: kart kendi adıyla; sil → çekmeceye düşmez, ekrandan kalkar
  await p.goto(BASE + '/?duzenle=1'); await p.getByRole('button', { name: 'Kahvem kartını düzenle' }).waitFor({ timeout: 15000 }).catch(() => fail('düzenlemede kendi adı yok'))
  await p.getByRole('button', { name: 'Sözüm kartını kaldır' }).click()
  await p.getByRole('button', { name: /Kart ekle/ }).first().click()
  await p.getByRole('button', { name: 'Sözüm ekle' }).waitFor({ timeout: 10000 }).catch(() => fail('kaldırılan kendi kartı çekmecede yok'))
  await p.goto(BASE + '/profil/ozellestirme/kartlarim'); await p.locator('[data-my-card="Sözüm"]').getByRole('button', { name: 'Sözüm sil' }).click()
  await msg('uc-msg', 'silindi'); await p.locator('[data-my-card="Sözüm"]').waitFor({ state: 'detached' })
  await p.goto(BASE + '/'); if (await card('Sözüm').count()) fail('silinen kart ekranda')

  // 6) Stüdyo özeti (şablondan çıkarma birim testte: tests/cards-custom.test.ts)
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-builder').innerText().then((t) => { if (!/4 kendi kartın/.test(t)) fail('stüdyo sayısı yanlış: ' + t) })

  console.log('ÖZELLEŞTİRME-11 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-11 E2E FAIL', e.message); process.exit(1) })
